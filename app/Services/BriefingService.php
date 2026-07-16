<?php

namespace App\Services;

use App\Exceptions\ApiException;
use CodeIgniter\HTTP\CURLRequest;
use Config\Gemini;
use DateTimeImmutable;
use DateTimeZone;
use Throwable;

/**
 * KI-Flug-Briefing (ADR-018): fasst die Wetterdaten eines Flugtreffens (ADR-017) über die
 * Gemini-API in 2–3 deutschen Sätzen zusammen. Der API-Key bleibt serverseitig (`.env`);
 * der Browser spricht nur unseren Endpunkt an — genau das von Google empfohlene Proxy-Muster.
 *
 * Grundhaltung wie beim Wetter selbst: **beschreiben, nie freigeben.** Die System-Instruktion
 * verbietet Flugempfehlungen; die UI kennzeichnet den Text als KI-generiert. Fehlende
 * Konfiguration und fehlendes Wetter sind Daten (`available:false` + Grund), kein Fehler —
 * nur ein echter Gemini-Ausfall wirft `503 briefing_unavailable`.
 *
 * In den Prompt fließen ausschließlich kuratierte Daten (Spot, Region, Level, Messwerte) —
 * bewusst kein Titel/keine Beschreibung des Treffens, damit Nutzertext keine Instruktionen
 * einschleusen kann.
 */
final class BriefingService
{
    private const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent';

    /** Gleiche Taktung wie der Wetter-Cache, damit Briefing und angezeigte Werte zusammenpassen. */
    private const CACHE_TTL = 1800;

    private const SYSTEM_INSTRUCTION = 'Du bist ein sachlicher Wetterassistent für eine deutschsprachige '
        . 'Gleitschirm-Community. Fasse die übergebenen Wetterdaten in 2 bis 3 kurzen, allgemein '
        . 'verständlichen deutschen Sätzen zusammen. Sprich NIEMALS eine Flugempfehlung, Freigabe oder '
        . 'Warnung aus — keine Formulierungen wie "gut fliegbar", "nicht fliegbar" oder "sicher". '
        . 'Beschreibe ausschließlich die Daten und ihre Entwicklung. Kein Markdown, keine Aufzählungen.';

    /** Deutsche Level-Labels für den Prompt (Enum-Keys bleiben englisch, §7 CLAUDE.md). */
    private const LEVEL_LABELS = [
        'beginner' => 'Einsteiger',
        'advanced' => 'Fortgeschrittene',
        'expert'   => 'Profis',
        'all'      => 'alle Erfahrungslevel',
    ];

    public function __construct(
        private ?CURLRequest $http = null,
        private ?WeatherService $weather = null,
        private ?Gemini $config = null,
    ) {
    }

    /**
     * Briefing-DTO für ein Flugtreffen. Ist kein Briefing möglich (kein Key, kein Wetter),
     * wird **kein** einziger Upstream-Call abgesetzt.
     *
     * @param array<string, mixed> $meetupRow Zeile aus {@see MeetupService::findRow()}
     * @return array<string, mixed>
     * @throws ApiException bei Gemini-/Wetter-Ausfall (503 `briefing_unavailable`)
     */
    public function forMeetup(array $meetupRow, ?DateTimeImmutable $now = null): array
    {
        $config = $this->config ?? config(Gemini::class);
        if (trim($config->apiKey) === '') {
            return $this->unavailable('not_configured');
        }

        try {
            $weatherDto = ($this->weather ?? new WeatherService($this->http))->forMeetup($meetupRow, $now);
        } catch (ApiException) {
            // Ohne Wetterdaten gibt es nichts zusammenzufassen — als Briefing-Ausfall melden
            // (den Wetter-Ausfall selbst meldet das Wetter-Panel bereits eigenständig).
            throw ApiException::upstreamUnavailable('briefing_unavailable', 'Das KI-Briefing ist derzeit nicht verfügbar.');
        }

        if ($weatherDto['available'] !== true) {
            return $this->unavailable((string) $weatherDto['reason']);
        }

        // Cache-Schlüssel folgt der Zielstunde des Wetters: läuft ein Treffen, wandert das
        // Briefing stündlich mit den angezeigten Werten mit. Fehlschläge werfen aus dem
        // Closure heraus und werden nie gecacht.
        $target = WeatherService::targetHour((string) $meetupRow['starts_at'], $now ?? new DateTimeImmutable('now', new DateTimeZone('UTC')));
        $key    = sprintf('briefing_%d_%s', (int) $meetupRow['id'], $target->format('Y-m-d_H'));

        $result = cache()->remember($key, self::CACHE_TTL, function () use ($meetupRow, $weatherDto, $config): array {
            $text = self::extractText($this->callGemini(self::buildPrompt($meetupRow, $weatherDto), $config));
            if ($text === null) {
                // Leere/blockierte Antwort: unbrauchbar, aber kein Grund für einen Datenzustand.
                throw ApiException::upstreamUnavailable('briefing_unavailable', 'Das KI-Briefing ist derzeit nicht verfügbar.');
            }

            return ['text' => $text, 'generated_at' => gmdate('Y-m-d\TH:i:s\Z')];
        });

        return [
            'available'    => true,
            'reason'       => null,
            'text'         => $result['text'],
            'generated_at' => $result['generated_at'],
        ];
    }

    /**
     * Deutscher Daten-Prompt aus Meetup-Zeile + Wetter-DTO. Zeiten in Europe/Berlin, damit der
     * Text lokale Uhrzeiten nennt (alle Spots liegen im DACH-Raum). Nullable Modellwerte
     * (Höhenwind, CAPE, Regenwahrscheinlichkeit) erscheinen nur, wenn vorhanden.
     *
     * @param array<string, mixed> $meetupRow
     * @param array<string, mixed> $weatherDto verfügbares DTO aus {@see WeatherService::forMeetup()}
     */
    public static function buildPrompt(array $meetupRow, array $weatherDto): string
    {
        $berlin   = new DateTimeZone('Europe/Berlin');
        $startsAt = (new DateTimeImmutable((string) $meetupRow['starts_at'], new DateTimeZone('UTC')))->setTimezone($berlin);
        $snapshot = $weatherDto['snapshot'];

        $lines = [
            'Flugtreffen am Startplatz ' . $meetupRow['spot_name'] . ' (' . $meetupRow['region'] . '), '
                . 'Start ' . $startsAt->format('d.m.Y \u\m H:i') . ' Uhr, Zielgruppe: '
                . (self::LEVEL_LABELS[$meetupRow['experience_level']] ?? 'alle Erfahrungslevel') . '.',
            sprintf('Bodenwind: %s km/h aus %d°, Böen %s km/h.', $snapshot['wind_speed_kmh'], $snapshot['wind_direction_deg'], $snapshot['wind_gusts_kmh']),
            sprintf('Temperatur %s °C, Bewölkung %d %%, Niederschlag %s mm, WMO-Wettercode %d.', $snapshot['temperature_c'], $snapshot['cloud_cover_pct'], $snapshot['precipitation_mm'], $snapshot['weather_code']),
        ];

        if ($snapshot['precipitation_probability_pct'] !== null) {
            $lines[] = sprintf('Regenwahrscheinlichkeit %d %%.', $snapshot['precipitation_probability_pct']);
        }
        if ($snapshot['wind_1500m_kmh'] !== null) {
            $lines[] = sprintf('Höhenwind auf ~1500 m: %s km/h.', $snapshot['wind_1500m_kmh']);
        }
        if ($snapshot['cape_j_kg'] !== null) {
            $lines[] = sprintf('CAPE %s J/kg.', $snapshot['cape_j_kg']);
        }

        $trend = [];
        foreach ($weatherDto['trend'] as $hour) {
            $at      = (new DateTimeImmutable((string) $hour['at']))->setTimezone($berlin);
            $trend[] = sprintf('%s Uhr %s km/h (Böen %s)', $at->format('H:i'), $hour['wind_speed_kmh'], $hour['wind_gusts_kmh']);
        }
        if ($trend !== []) {
            $lines[] = 'Windverlauf: ' . implode(', ', $trend) . '.';
        }

        return implode("\n", $lines);
    }

    /**
     * Generierten Text aus der Gemini-Antwort ziehen — `null` bei fehlenden Kandidaten,
     * leeren Parts oder Safety-Block (`promptFeedback.blockReason` ohne Kandidaten).
     *
     * @param array<string, mixed> $responseBody
     */
    public static function extractText(array $responseBody): ?string
    {
        $text = $responseBody['candidates'][0]['content']['parts'][0]['text'] ?? null;
        if (! is_string($text)) {
            return null;
        }
        $text = trim($text);

        return $text === '' ? null : $text;
    }

    /**
     * Der eigentliche Gemini-Call. **Absolute URL + Optionen pro Request**: der geteilte
     * `curlrequest`-Service wurde ggf. schon vom WeatherService mit Open-Meteo-BaseURI und
     * 4-s-Timeout erzeugt — beides würde hier sonst durchschlagen (LLMs brauchen länger).
     *
     * @return array<string, mixed> dekodierter Antwort-Body
     * @throws ApiException
     */
    private function callGemini(string $prompt, Gemini $config): array
    {
        try {
            $response = ($this->http ??= service('curlrequest'))->post(sprintf(self::ENDPOINT, $config->model), [
                'headers'         => ['x-goog-api-key' => $config->apiKey],
                'json'            => [
                    'contents'          => [['parts' => [['text' => $prompt]]]],
                    'systemInstruction' => ['parts' => [['text' => self::SYSTEM_INSTRUCTION]]],
                    'generationConfig'  => [
                        'temperature' => 0.3,
                        // Großzügig: Flash-Modelle "denken" intern mit und zählen diese Tokens aufs
                        // Budget an — ein knappes Limit schneidet den Text ab (finishReason
                        // MAX_TOKENS). `thinkingConfig` bewusst weggelassen: die Parameter dafür
                        // sind je Modellgeneration inkompatibel (2.5: thinkingBudget, 3.x lehnt
                        // das ab) und das Modell ist per Config frei wählbar.
                        'maxOutputTokens' => 1024,
                    ],
                ],
                'timeout'         => 15,
                'connect_timeout' => 5,
                'http_errors'     => false,
            ]);

            $status = $response->getStatusCode();
            $body   = json_decode((string) $response->getBody(), true);
        } catch (Throwable) {
            throw ApiException::upstreamUnavailable('briefing_unavailable', 'Das KI-Briefing ist derzeit nicht verfügbar.');
        }

        if ($status === 429) {
            // Frei-Kontingent erschöpft — ehrlicher benennen als ein generischer Ausfall.
            throw ApiException::upstreamUnavailable('briefing_unavailable', 'Das KI-Briefing ist gerade ausgelastet — bitte versuche es später erneut.');
        }
        if ($status !== 200 || ! is_array($body)) {
            throw ApiException::upstreamUnavailable('briefing_unavailable', 'Das KI-Briefing ist derzeit nicht verfügbar.');
        }

        return $body;
    }

    /** @return array<string, mixed> */
    private function unavailable(string $reason): array
    {
        return ['available' => false, 'reason' => $reason, 'text' => null, 'generated_at' => null];
    }
}
