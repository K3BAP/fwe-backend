<?php

namespace App\Services;

use App\Exceptions\ApiException;
use CodeIgniter\HTTP\CURLRequest;
use DateTimeImmutable;
use DateTimeZone;
use Throwable;

/**
 * Wetter am Startplatz eines Flugtreffens (ADR-017) — dünner Proxy auf **Open-Meteo**
 * (kostenlos, kein API-Key). Der Server leitet Koordinaten und Zeitpunkt aus der Meetup-Zeile ab;
 * der Client übergibt nie eigene Koordinaten.
 *
 * Nicht-Verfügbarkeit ist **Datum, kein Fehler**: vergangene Treffen, Treffen jenseits des
 * Vorhersage-Horizonts und Treffen ohne Koordinaten liefern `available: false` samt Grund (HTTP 200).
 * Nur ein echter Upstream-Ausfall wirft {@see ApiException::upstreamUnavailable()} (503).
 *
 * `meetups.starts_at` liegt als UTC-DATETIME vor, deshalb wird die Vorhersage mit `timezone=UTC`
 * angefragt: die Stundenachse von Open-Meteo ist dann direkt vergleichbar — keine Zeitzonen-Arithmetik.
 */
final class WeatherService
{
    private const BASE_URI = 'https://api.open-meteo.com/';

    /** Upstream-Antworten pro Startplatz+Tag zwischenspeichern (Sekunden). */
    private const CACHE_TTL = 1800;

    /** Ein laufendes Treffen zeigt weiter Wetter — erst danach ist die Prognose wertlos. */
    private const PAST_GRACE_HOURS = 2;

    /** Open-Meteo liefert 16 Tage inkl. heute → letzter prognostizierbarer Tag = heute + 15. */
    private const FORECAST_HORIZON_DAYS = 15;

    private const HOURLY_FIELDS = 'temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m'
        . ',precipitation_probability,precipitation,cloud_cover,weather_code'
        . ',wind_speed_850hPa,wind_direction_850hPa,cape';

    /** Der HTTP-Client wird erst bei Bedarf erzeugt (Tests injizieren ihn). */
    public function __construct(private ?CURLRequest $http = null)
    {
    }

    /**
     * Wetter-DTO für ein Flugtreffen. Ist es nicht verfügbar, wird **kein** Upstream-Call abgesetzt.
     *
     * @param array<string, mixed> $meetupRow Zeile aus {@see MeetupService::findRow()}
     * @return array<string, mixed>
     * @throws ApiException bei Upstream-Ausfall (503)
     */
    public function forMeetup(array $meetupRow, ?DateTimeImmutable $now = null): array
    {
        $now       = $now ?? new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $startsAt  = (string) $meetupRow['starts_at'];
        $present   = new WeatherPresenter();

        $reason = self::availability($meetupRow['lat'], $meetupRow['lng'], $startsAt, $now);
        if ($reason !== null) {
            return $present->unavailable($reason);
        }

        // Das Abfragefenster deckt den Trend ab und überspannt bei Bedarf die Tagesgrenze.
        $target = self::targetHour($startsAt, $now);
        $hourly = $this->fetchHourly(
            (float) $meetupRow['lat'],
            (float) $meetupRow['lng'],
            $target->modify('-' . WeatherPresenter::TREND_BEFORE . ' hours')->format('Y-m-d'),
            $target->modify('+' . WeatherPresenter::TREND_AFTER . ' hours')->format('Y-m-d'),
        );

        $index = self::hourIndex($hourly['time'] ?? [], $target);
        if ($index === null) {
            // Die angefragte Stunde fehlt in der Antwort → Upstream ist unbrauchbar, nicht „nicht verfügbar".
            throw ApiException::upstreamUnavailable('weather_unavailable', 'Wetterdaten sind derzeit nicht verfügbar.');
        }

        return $present->present($hourly, $index, $target == self::floorToHour($now));
    }

    /**
     * Grund, warum es kein Wetter gibt — oder `null`, wenn eine Vorhersage möglich ist.
     * Der Meetup-Status spielt bewusst keine Rolle: ein abgesagtes, aber künftiges Treffen zeigt
     * weiterhin Wetter (die Absage kommuniziert die Detailseite bereits selbst).
     *
     * @return 'no_location'|'past'|'out_of_range'|null
     */
    public static function availability(?string $lat, ?string $lng, string $startsAtDb, DateTimeImmutable $now): ?string
    {
        if ($lat === null || $lng === null) {
            return 'no_location';
        }

        $startsAt = self::parseUtc($startsAtDb);

        if ($startsAt < $now->modify('-' . self::PAST_GRACE_HOURS . ' hours')) {
            return 'past';
        }
        if ($startsAt->format('Y-m-d') > $now->modify('+' . self::FORECAST_HORIZON_DAYS . ' days')->format('Y-m-d')) {
            return 'out_of_range';
        }

        return null;
    }

    /**
     * Die Stunde, für die Werte gezeigt werden: die Startstunde des Treffens — oder die **aktuelle**
     * Stunde, wenn das Treffen bereits läuft (dann ist das Ist-Wetter relevanter als die Startprognose).
     */
    public static function targetHour(string $startsAtDb, DateTimeImmutable $now): DateTimeImmutable
    {
        $startsAt = self::floorToHour(self::parseUtc($startsAtDb));
        $nowHour  = self::floorToHour($now);

        return $startsAt > $nowHour ? $startsAt : $nowHour;
    }

    /**
     * Position der Zielstunde auf der Stundenachse (`2026-07-14T15:00`), oder `null` bei Fehlanzeige.
     *
     * @param list<string> $times
     */
    public static function hourIndex(array $times, DateTimeImmutable $target): ?int
    {
        $needle = $target->format('Y-m-d\TH:i');
        $index  = array_search($needle, $times, true);

        return $index === false ? null : (int) $index;
    }

    /**
     * Roher `hourly`-Block von Open-Meteo, gecacht pro gerundeter Koordinate + Datumsfenster.
     * Gerundet auf 2 Nachkommastellen (~1,1 km): Treffen am selben Startplatz teilen sich einen Call.
     * Gecacht wird die **Rohantwort** — `is_current` und das Trend-Fenster hängen von `now` ab und
     * dürfen nicht mit einfrieren.
     *
     * @return array<string, list<mixed>>
     * @throws ApiException
     */
    private function fetchHourly(float $lat, float $lng, string $startDate, string $endDate): array
    {
        $key = sprintf('weather_%s_%s_%s_%s', number_format($lat, 2, '_', ''), number_format($lng, 2, '_', ''), $startDate, $endDate);
        $key = preg_replace('/[^a-z0-9_-]/i', '_', $key);

        return cache()->remember($key, self::CACHE_TTL, function () use ($lat, $lng, $startDate, $endDate): array {
            try {
                $response = $this->client()->get('v1/forecast', ['query' => [
                    'latitude'        => $lat,
                    'longitude'       => $lng,
                    'hourly'          => self::HOURLY_FIELDS,
                    'timezone'        => 'UTC',
                    'wind_speed_unit' => 'kmh',
                    'start_date'      => $startDate,
                    'end_date'        => $endDate,
                ]]);

                $status = $response->getStatusCode();
                $body   = json_decode((string) $response->getBody(), true);
            } catch (Throwable) {
                // Timeout, DNS, fehlendes ext-curl auf dem Webspace: alles ein Upstream-Ausfall.
                throw ApiException::upstreamUnavailable('weather_unavailable', 'Wetterdaten sind derzeit nicht verfügbar.');
            }

            if ($status !== 200 || ! is_array($body) || ! isset($body['hourly']['time'])) {
                throw ApiException::upstreamUnavailable('weather_unavailable', 'Wetterdaten sind derzeit nicht verfügbar.');
            }

            return $body['hourly'];
        });
    }

    /** Kurze Timeouts: der Endpunkt scheitert schnell, statt die Detailseite hängen zu lassen. */
    private function client(): CURLRequest
    {
        return $this->http ??= service('curlrequest', [
            'baseURI'         => self::BASE_URI,
            'timeout'         => 4,
            'connect_timeout' => 3,
            'http_errors'     => false,
        ]);
    }

    private static function parseUtc(string $datetimeDb): DateTimeImmutable
    {
        return new DateTimeImmutable($datetimeDb, new DateTimeZone('UTC'));
    }

    private static function floorToHour(DateTimeImmutable $moment): DateTimeImmutable
    {
        return $moment->setTime((int) $moment->format('G'), 0);
    }
}
