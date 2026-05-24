<?php

namespace App\Services;

use App\Models\TaskModel;

/**
 * Bewertet eine Abgabe im Moment der Abgabe für deterministische Aufgabentypen.
 * Rangbasierte Typen (numeric_estimate, onsite_time) werden hier NICHT final
 * bewertet – ihre Punkte berechnet der ScoringService beim Lesen.
 */
class GradingService
{
    /**
     * Liefert die zu speichernden Felder (status, awarded_points) für eine Abgabe.
     *
     * @param array<string,mixed> $task    Aufgaben-Datensatz
     * @param array<string,mixed> $payload Eingabe des Teilnehmers
     * @return array{status:string, awarded_points:?int}
     */
    public function grade(array $task, array $payload): array
    {
        $type   = $task['type'];
        $max    = (int) $task['max_points'];
        $config = TaskModel::decodeConfig($task);

        switch ($type) {
            case 'multiple_choice':
                $correct = isset($config['correct_index'])
                    && (int) ($payload['answer_choice'] ?? -1) === (int) $config['correct_index'];

                return $this->binary($correct, $max);

            case 'exact_text':
                $accepted = array_map([$this, 'normalize'], $config['accepted'] ?? []);
                $given    = $this->normalize((string) ($payload['answer_text'] ?? ''));

                return $this->binary(in_array($given, $accepted, true), $max);

            case 'gps_checkin':
                $ok = $this->withinRadius(
                    (float) ($payload['lat'] ?? 0),
                    (float) ($payload['lng'] ?? 0),
                    (float) ($config['lat'] ?? 0),
                    (float) ($config['lng'] ?? 0),
                    (float) ($config['radius_m'] ?? 50),
                );

                return $this->binary($ok, $max);

            case 'free_text':
                // Treffer einer Musterlösung -> sofort korrekt, sonst manuelle Bewertung.
                $samples = array_map([$this, 'normalize'], $config['sample_solutions'] ?? []);
                $given   = $this->normalize((string) ($payload['answer_text'] ?? ''));

                if ($samples !== [] && in_array($given, $samples, true)) {
                    return ['status' => 'correct', 'awarded_points' => $max];
                }

                return ['status' => 'pending', 'awarded_points' => null];

            case 'photo_upload':
                return ['status' => 'pending', 'awarded_points' => null];

            case 'numeric_estimate':
            case 'onsite_time':
                // Rangbasiert -> Rohwert speichern, Punkte beim Lesen berechnen.
                return ['status' => 'evaluated', 'awarded_points' => null];

            case 'onsite_points':
                // Wartet auf Eintrag durch die Aufsicht.
                return ['status' => 'pending', 'awarded_points' => null];
        }

        return ['status' => 'pending', 'awarded_points' => null];
    }

    /** @return array{status:string, awarded_points:int} */
    private function binary(bool $correct, int $max): array
    {
        return [
            'status'         => $correct ? 'correct' : 'incorrect',
            'awarded_points' => $correct ? $max : 0,
        ];
    }

    private function normalize(string $value): string
    {
        $value = trim(mb_strtolower($value));

        return preg_replace('/\s+/u', ' ', $value) ?? $value;
    }

    /** Haversine-Distanz in Metern, Vergleich mit Radius. */
    private function withinRadius(float $lat1, float $lng1, float $lat2, float $lng2, float $radius): bool
    {
        $earth = 6371000.0;
        $dLat  = deg2rad($lat2 - $lat1);
        $dLng  = deg2rad($lng2 - $lng1);
        $a     = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        $dist = $earth * 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $dist <= $radius;
    }
}
