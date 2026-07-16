<?php

use App\Exceptions\ApiException;
use App\Services\WeatherPresenter;
use App\Services\WeatherService;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit-Tests der reinen Wetter-Logik (ADR-017): Verfügbarkeits-Regeln, Wahl der Zielstunde,
 * Treffer auf der Stundenachse und die DTO-Projektion. Alles ohne HTTP und ohne Datenbank —
 * der Upstream-Pfad wird in MeetupWeatherTest geprüft.
 *
 * @internal
 */
final class WeatherLogicTest extends CIUnitTestCase
{
    private const NOW = '2026-07-10 12:30:00';

    private function now(): DateTimeImmutable
    {
        return new DateTimeImmutable(self::NOW, new DateTimeZone('UTC'));
    }

    /** Stundenachse wie Open-Meteo sie liefert (`Y-m-d\TH:i`), 24 Stunden ab Mitternacht. */
    private function hourly(int $hours = 24, array $overrides = []): array
    {
        $hourly = ['time' => []];
        $fields = [
            'temperature_2m' => 21.5, 'wind_speed_10m' => 12.4, 'wind_gusts_10m' => 18.9,
            'wind_direction_10m' => 225, 'precipitation_probability' => 10, 'precipitation' => 0.0,
            'cloud_cover' => 40, 'weather_code' => 2, 'wind_speed_850hPa' => 24.0,
            'wind_direction_850hPa' => 240, 'cape' => 350.0,
        ];
        for ($i = 0; $i < $hours; $i++) {
            $hourly['time'][] = sprintf('2026-07-10T%02d:00', $i);
            foreach ($fields as $field => $value) {
                $hourly[$field][] = $value;
            }
        }

        return array_replace($hourly, $overrides);
    }

    // --- availability ---------------------------------------------------------

    public function testAvailabilityIsNullWhenForecastIsPossible(): void
    {
        $this->assertNull(WeatherService::availability('47.5', '11.0', '2026-07-10 16:00:00', $this->now()));
    }

    public function testAvailabilityReportsMissingCoordinates(): void
    {
        $this->assertSame('no_location', WeatherService::availability(null, null, '2026-07-10 16:00:00', $this->now()));
    }

    public function testAvailabilityReportsPastOnlyBeyondTheGracePeriod(): void
    {
        // Läuft seit einer Stunde → Wetter bleibt relevant.
        $this->assertNull(WeatherService::availability('47.5', '11.0', '2026-07-10 11:30:00', $this->now()));
        // Seit drei Stunden vorbei → keine Prognose mehr.
        $this->assertSame('past', WeatherService::availability('47.5', '11.0', '2026-07-10 09:00:00', $this->now()));
    }

    public function testAvailabilityReportsOutOfRangeBeyondTheForecastHorizon(): void
    {
        $this->assertNull(WeatherService::availability('47.5', '11.0', '2026-07-25 10:00:00', $this->now()));
        $this->assertSame('out_of_range', WeatherService::availability('47.5', '11.0', '2026-07-26 10:00:00', $this->now()));
    }

    public function testMissingCoordinatesOutrankOtherReasons(): void
    {
        $this->assertSame('no_location', WeatherService::availability(null, '11.0', '2020-01-01 10:00:00', $this->now()));
    }

    // --- targetHour / hourIndex ----------------------------------------------

    public function testTargetHourFloorsTheStartOfAFutureMeetup(): void
    {
        $target = WeatherService::targetHour('2026-07-10 16:45:00', $this->now());
        $this->assertSame('2026-07-10T16:00', $target->format('Y-m-d\TH:i'));
    }

    public function testTargetHourFallsBackToTheCurrentHourForARunningMeetup(): void
    {
        $target = WeatherService::targetHour('2026-07-10 11:15:00', $this->now());
        $this->assertSame('2026-07-10T12:00', $target->format('Y-m-d\TH:i'));
    }

    public function testHourIndexFindsTheHourOrReportsNothing(): void
    {
        $times = ['2026-07-10T15:00', '2026-07-10T16:00', '2026-07-10T17:00'];
        $this->assertSame(1, WeatherService::hourIndex($times, new DateTimeImmutable('2026-07-10 16:00', new DateTimeZone('UTC'))));
        $this->assertNull(WeatherService::hourIndex($times, new DateTimeImmutable('2026-07-11 16:00', new DateTimeZone('UTC'))));
    }

    // --- presenter ------------------------------------------------------------

    public function testUnavailableCarriesTheReasonAndNoData(): void
    {
        $dto = (new WeatherPresenter())->unavailable('past');

        $this->assertFalse($dto['available']);
        $this->assertSame('past', $dto['reason']);
        $this->assertFalse($dto['is_current']);
        $this->assertNull($dto['snapshot']);
        $this->assertSame([], $dto['trend']);
    }

    public function testPresentShapesTheSnapshotWithTypedFields(): void
    {
        $dto = (new WeatherPresenter())->present($this->hourly(), 16, false);

        $this->assertTrue($dto['available']);
        $this->assertNull($dto['reason']);
        $this->assertSame('2026-07-10T16:00:00Z', $dto['snapshot']['at']);
        $this->assertSame(12.4, $dto['snapshot']['wind_speed_kmh']);
        $this->assertSame(18.9, $dto['snapshot']['wind_gusts_kmh']);
        $this->assertSame(225, $dto['snapshot']['wind_direction_deg']);
        $this->assertSame(10, $dto['snapshot']['precipitation_probability_pct']);
        $this->assertSame(24.0, $dto['snapshot']['wind_1500m_kmh']);
        $this->assertSame(350.0, $dto['snapshot']['cape_j_kg']);
        $this->assertCount(6, $dto['trend']); // 2 davor + Zielstunde + 3 danach
        $this->assertSame('2026-07-10T14:00:00Z', $dto['trend'][0]['at']);
    }

    public function testPresentLeavesOptionalModelFieldsNull(): void
    {
        $hourly = $this->hourly();
        unset($hourly['wind_speed_850hPa'], $hourly['cape']);
        $hourly['precipitation_probability'][16] = null;

        $snapshot = (new WeatherPresenter())->present($hourly, 16, false)['snapshot'];

        $this->assertNull($snapshot['wind_1500m_kmh']);
        $this->assertNull($snapshot['cape_j_kg']);
        $this->assertNull($snapshot['precipitation_probability_pct']);
        $this->assertSame(12.4, $snapshot['wind_speed_kmh']); // Kernwerte bleiben unberührt
    }

    public function testPresentClampsTheTrendAtBothEndsOfTheSeries(): void
    {
        $present = new WeatherPresenter();

        $this->assertCount(4, $present->present($this->hourly(), 0, true)['trend']);   // 0..3
        $this->assertCount(3, $present->present($this->hourly(), 23, false)['trend']); // 21..23
    }

    public function testPresentDropsTrendHoursWithMissingCoreValues(): void
    {
        $hourly = $this->hourly();
        $hourly['wind_speed_10m'][15] = null;

        $dto = (new WeatherPresenter())->present($hourly, 16, false);

        $this->assertCount(5, $dto['trend']);
        $this->assertNotContains('2026-07-10T15:00:00Z', array_column($dto['trend'], 'at'));
    }

    public function testPresentRejectsAnUnusableTargetHour(): void
    {
        $hourly = $this->hourly();
        $hourly['temperature_2m'][16] = null;

        $this->expectException(ApiException::class);
        $this->expectExceptionMessage('Wetterdaten sind derzeit nicht verfügbar.');
        (new WeatherPresenter())->present($hourly, 16, false);
    }
}
