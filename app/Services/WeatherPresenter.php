<?php

namespace App\Services;

use App\Exceptions\ApiException;

/**
 * Formt den rohen `hourly`-Block von Open-Meteo in das Wetter-DTO (ADR-017, API.md §5.6) — die
 * einzige Stelle, die Upstream-Feldnamen kennt. Feldnamen und Typen entsprechen exakt dem
 * Wire-Vertrag (`frontend/src/api/schemas/weather.ts`).
 *
 * Für Gleitschirmflieger relevant sind vor allem **Bodenwind (10 m) und Böen**; Höhenwind (850 hPa
 * ≈ 1500 m) und CAPE (Thermik) liefern nicht alle Modelle — sie bleiben nullable.
 */
final class WeatherPresenter
{
    /** Trend-Fenster um die Zielstunde (Stunden davor/danach) — bestimmt auch das Abfragefenster. */
    public const TREND_BEFORE = 2;
    public const TREND_AFTER  = 3;

    /**
     * Kein Wetter, aber auch kein Fehler (vergangen / außerhalb des Horizonts / ohne Koordinaten).
     *
     * @return array<string, mixed>
     */
    public function unavailable(string $reason): array
    {
        return [
            'available'  => false,
            'reason'     => $reason,
            'is_current' => false,
            'snapshot'   => null,
            'trend'      => [],
        ];
    }

    /**
     * Snapshot der Zielstunde + Trend-Fenster darum (an den Rändern der Zeitreihe beschnitten).
     * Stunden mit lückenhaften Kernwerten fallen aus dem Trend heraus; fehlt die Zielstunde selbst,
     * ist die Upstream-Antwort unbrauchbar.
     *
     * @param array<string, list<mixed>> $hourly
     * @return array<string, mixed>
     * @throws ApiException
     */
    public function present(array $hourly, int $index, bool $isCurrent): array
    {
        $snapshot = $this->hourAt($hourly, $index);
        if ($snapshot === null) {
            throw ApiException::upstreamUnavailable('weather_unavailable', 'Wetterdaten sind derzeit nicht verfügbar.');
        }

        $last  = count($hourly['time']) - 1;
        $trend = [];
        for ($i = max(0, $index - self::TREND_BEFORE); $i <= min($last, $index + self::TREND_AFTER); $i++) {
            $hour = $this->hourAt($hourly, $i);
            if ($hour !== null) {
                $trend[] = $hour;
            }
        }

        return [
            'available'  => true,
            'reason'     => null,
            'is_current' => $isCurrent,
            'snapshot'   => $snapshot,
            'trend'      => $trend,
        ];
    }

    /**
     * Eine Stunde der Zeitreihe — oder `null`, wenn ein Kernwert fehlt (Modell-Lücke).
     *
     * @param array<string, list<mixed>> $hourly
     * @return array<string, mixed>|null
     */
    private function hourAt(array $hourly, int $index): ?array
    {
        $core = [];
        foreach (['time', 'temperature_2m', 'wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m', 'precipitation', 'cloud_cover', 'weather_code'] as $field) {
            $value = $hourly[$field][$index] ?? null;
            if ($value === null) {
                return null;
            }
            $core[$field] = $value;
        }

        return [
            'at'                            => $core['time'] . ':00Z',
            'temperature_c'                 => (float) $core['temperature_2m'],
            'wind_speed_kmh'                => (float) $core['wind_speed_10m'],
            'wind_gusts_kmh'                => (float) $core['wind_gusts_10m'],
            'wind_direction_deg'            => (int) $core['wind_direction_10m'],
            'precipitation_probability_pct' => $this->optionalInt($hourly, 'precipitation_probability', $index),
            'precipitation_mm'              => (float) $core['precipitation'],
            'cloud_cover_pct'               => (int) $core['cloud_cover'],
            'weather_code'                  => (int) $core['weather_code'],
            'wind_1500m_kmh'                => $this->optionalFloat($hourly, 'wind_speed_850hPa', $index),
            'wind_1500m_direction_deg'      => $this->optionalInt($hourly, 'wind_direction_850hPa', $index),
            'cape_j_kg'                     => $this->optionalFloat($hourly, 'cape', $index),
        ];
    }

    /** @param array<string, list<mixed>> $hourly */
    private function optionalFloat(array $hourly, string $field, int $index): ?float
    {
        $value = $hourly[$field][$index] ?? null;

        return $value === null ? null : (float) $value;
    }

    /** @param array<string, list<mixed>> $hourly */
    private function optionalInt(array $hourly, string $field, int $index): ?int
    {
        $value = $hourly[$field][$index] ?? null;

        return $value === null ? null : (int) $value;
    }
}
