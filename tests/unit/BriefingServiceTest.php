<?php

use App\Services\BriefingService;
use CodeIgniter\Test\CIUnitTestCase;
use Config\Gemini;
use Tests\Support\Libraries\FakeCurlRequest;

/**
 * Unit-Tests der reinen Briefing-Logik (ADR-018): Prompt-Aufbau, Text-Extraktion aus der
 * Gemini-Antwort und die Kurzschluss-Pfade (kein Key / kein Wetter), die ohne jeden
 * Upstream-Call auskommen müssen. Der HTTP-Pfad selbst läuft in MeetupBriefingTest.
 *
 * @internal
 */
final class BriefingServiceTest extends CIUnitTestCase
{
    /** @param array<string, mixed> $snapshotOverrides */
    private function weatherDto(array $snapshotOverrides = []): array
    {
        $snapshot = array_merge([
            'at'                            => '2026-07-12T08:00:00Z',
            'temperature_c'                 => 21.5,
            'wind_speed_kmh'                => 12.4,
            'wind_gusts_kmh'                => 18.9,
            'wind_direction_deg'            => 225,
            'precipitation_probability_pct' => 10,
            'precipitation_mm'              => 0.0,
            'cloud_cover_pct'               => 40,
            'weather_code'                  => 2,
            'wind_1500m_kmh'                => 24.0,
            'wind_1500m_direction_deg'      => 240,
            'cape_j_kg'                     => 350.0,
        ], $snapshotOverrides);

        return [
            'available'  => true,
            'reason'     => null,
            'is_current' => false,
            'snapshot'   => $snapshot,
            'trend'      => [
                $snapshot,
                array_merge($snapshot, ['at' => '2026-07-12T09:00:00Z', 'wind_speed_kmh' => 15.0]),
            ],
        ];
    }

    /** @param array<string, mixed> $overrides */
    private function meetupRow(array $overrides = []): array
    {
        return array_merge([
            'id'               => 7,
            'spot_name'        => 'Brauneck',
            'region'           => 'Bayerische Voralpen',
            'lat'              => '47.667000',
            'lng'              => '11.555000',
            'starts_at'        => '2026-07-12 08:00:00',
            'experience_level' => 'advanced',
        ], $overrides);
    }

    // --- buildPrompt ------------------------------------------------------------

    public function testPromptCarriesSpotLevelAndTheKeyNumbers(): void
    {
        $prompt = BriefingService::buildPrompt($this->meetupRow(), $this->weatherDto());

        $this->assertStringContainsString('Brauneck', $prompt);
        $this->assertStringContainsString('Bayerische Voralpen', $prompt);
        $this->assertStringContainsString('Fortgeschrittene', $prompt);
        $this->assertStringContainsString('12.4 km/h', $prompt);
        $this->assertStringContainsString('Böen 18.9', $prompt);
        $this->assertStringContainsString('21.5 °C', $prompt);
        $this->assertStringContainsString('Windverlauf:', $prompt);
        // UTC 08:00 → Berlin 10:00 (Sommerzeit): der Prompt spricht lokale Uhrzeiten.
        $this->assertStringContainsString('10:00 Uhr', $prompt);
    }

    public function testPromptOmitsOptionalModelValuesWhenAbsent(): void
    {
        $dto = $this->weatherDto(['wind_1500m_kmh' => null, 'cape_j_kg' => null, 'precipitation_probability_pct' => null]);

        $prompt = BriefingService::buildPrompt($this->meetupRow(), $dto);

        $this->assertStringNotContainsString('Höhenwind', $prompt);
        $this->assertStringNotContainsString('CAPE', $prompt);
        $this->assertStringNotContainsString('Regenwahrscheinlichkeit', $prompt);
    }

    // --- extractText ------------------------------------------------------------

    public function testExtractTextReturnsTheTrimmedCandidateText(): void
    {
        $body = ['candidates' => [['content' => ['parts' => [['text' => "  Ruhiger Südwestwind.  \n"]]]]]];

        $this->assertSame('Ruhiger Südwestwind.', BriefingService::extractText($body));
    }

    public function testExtractTextRejectsMissingEmptyOrBlockedResponses(): void
    {
        $this->assertNull(BriefingService::extractText([]));
        $this->assertNull(BriefingService::extractText(['candidates' => [['content' => ['parts' => []]]]]));
        $this->assertNull(BriefingService::extractText(['candidates' => [['content' => ['parts' => [['text' => '   ']]]]]]));
        $this->assertNull(BriefingService::extractText(['promptFeedback' => ['blockReason' => 'SAFETY']]));
    }

    // --- Kurzschluss-Pfade ohne Upstream -----------------------------------------

    public function testMissingApiKeyShortCircuitsWithoutAnyHttpCall(): void
    {
        $fake   = FakeCurlRequest::routing([]);
        $config = new Gemini();
        $config->apiKey = '';

        $dto = (new BriefingService($fake, null, $config))->forMeetup($this->meetupRow());

        $this->assertFalse($dto['available']);
        $this->assertSame('not_configured', $dto['reason']);
        $this->assertNull($dto['text']);
        $this->assertSame(0, $fake->calls);
    }

    public function testWeatherUnavailabilityPassesThroughWithoutGeminiCall(): void
    {
        $fake   = FakeCurlRequest::routing([]);
        $config = new Gemini();
        $config->apiKey = 'test-key';
        // Treffen liegt einen Tag zurück → WeatherService meldet `past`, ganz ohne HTTP.
        $row = $this->meetupRow(['starts_at' => gmdate('Y-m-d H:i:s', time() - 86400)]);

        $dto = (new BriefingService($fake, null, $config))->forMeetup($row);

        $this->assertFalse($dto['available']);
        $this->assertSame('past', $dto['reason']);
        $this->assertSame(0, $fake->calls);
    }
}
