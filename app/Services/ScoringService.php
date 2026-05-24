<?php

namespace App\Services;

use App\Models\SubmissionModel;
use App\Models\TaskModel;
use App\Models\TeamModel;

/**
 * Berechnet Punkte & Leaderboard beim Lesen. Deterministische und manuell
 * bewertete Abgaben nutzen das gespeicherte awarded_points; rangbasierte Typen
 * (numeric_estimate, onsite_time) werden hier über alle Teams hinweg neu
 * berechnet, damit die Stände korrekt bleiben, sobald neue Abgaben eintreffen.
 */
class ScoringService
{
    /**
     * Vollständige Auswertung einer Rallye.
     *
     * @return array{teams: array<int, array{team: array, total: int, tasks: array<int, array{status:string, points:?int}>}>}
     */
    public function computeRallye(int $rallyeId): array
    {
        $teams       = (new TeamModel())->where('rallye_id', $rallyeId)->orderBy('id')->findAll();
        $tasks       = (new TaskModel())->forRallye($rallyeId);
        $submissions = (new SubmissionModel())->forRallye($rallyeId);

        // Abgaben nach task_id gruppieren.
        $byTask = [];
        foreach ($submissions as $s) {
            $byTask[(int) $s['task_id']][] = $s;
        }

        // Ergebnis-Gerüst je Team initialisieren.
        $result = [];
        foreach ($teams as $team) {
            $result[(int) $team['id']] = ['team' => $team, 'total' => 0, 'tasks' => []];
        }

        foreach ($tasks as $task) {
            $taskId  = (int) $task['id'];
            $type    = $task['type'];
            $max     = (int) $task['max_points'];
            $subs    = $byTask[$taskId] ?? [];

            if (in_array($type, TaskModel::RANK_TYPES, true)) {
                $points = $this->rankPoints($task, $subs, $max);
                foreach ($subs as $s) {
                    $teamId = (int) $s['team_id'];
                    if (! isset($result[$teamId])) {
                        continue;
                    }
                    $p = $points[$teamId] ?? 0;
                    $result[$teamId]['tasks'][$taskId] = ['status' => 'evaluated', 'points' => $p];
                    $result[$teamId]['total'] += $p;
                }
            } else {
                foreach ($subs as $s) {
                    $teamId = (int) $s['team_id'];
                    if (! isset($result[$teamId])) {
                        continue;
                    }
                    $p = $s['awarded_points'] !== null ? (int) $s['awarded_points'] : 0;
                    $result[$teamId]['tasks'][$taskId] = ['status' => $s['status'], 'points' => $s['status'] === 'pending' ? null : $p];
                    if ($s['status'] !== 'pending') {
                        $result[$teamId]['total'] += $p;
                    }
                }
            }
        }

        return ['teams' => $result];
    }

    /**
     * Nach Gesamtpunkten absteigend sortiertes Leaderboard.
     *
     * @return list<array{rank:int, team_id:int, name:string, total:int}>
     */
    public function leaderboard(int $rallyeId): array
    {
        $computed = $this->computeRallye($rallyeId)['teams'];

        $rows = [];
        foreach ($computed as $teamId => $data) {
            $rows[] = [
                'team_id' => $teamId,
                'name'    => $data['team']['name'],
                'total'   => $data['total'],
            ];
        }

        usort($rows, static fn ($a, $b) => $b['total'] <=> $a['total'] ?: strcmp($a['name'], $b['name']));

        $rank     = 0;
        $lastTotal = null;
        foreach ($rows as $i => &$row) {
            if ($row['total'] !== $lastTotal) {
                $rank      = $i + 1;
                $lastTotal = $row['total'];
            }
            $row['rank'] = $rank;
        }

        return $rows;
    }

    /**
     * Punkte- & Status-Aufschlüsselung je Aufgabe für ein einzelnes Team.
     *
     * @return array<int, array{status:string, points:?int}>
     */
    public function teamBreakdown(int $rallyeId, int $teamId): array
    {
        $computed = $this->computeRallye($rallyeId)['teams'];

        return $computed[$teamId]['tasks'] ?? [];
    }

    /**
     * Rangbasierte Punktevergabe: bester Wert = max_points, schlechtester = 0,
     * linear skaliert. Gleichstände erhalten gleiche Punkte.
     *
     * @param array<string,mixed>       $task
     * @param list<array<string,mixed>> $subs
     * @return array<int,int> team_id => points
     */
    private function rankPoints(array $task, array $subs, int $max): array
    {
        // Sortierschlüssel je Team (kleiner = besser).
        $keys = [];
        foreach ($subs as $s) {
            $key = $this->rankKey($task, $s);
            if ($key !== null) {
                $keys[(int) $s['team_id']] = $key;
            }
        }

        $n = count($keys);
        if ($n === 0) {
            return [];
        }
        if ($n === 1) {
            return [array_key_first($keys) => $max];
        }

        $points = [];
        foreach ($keys as $teamId => $key) {
            // Anzahl Teams mit echt besserem (kleinerem) Wert -> Rangstufe.
            $better = 0;
            foreach ($keys as $otherKey) {
                if ($otherKey < $key) {
                    $better++;
                }
            }
            $points[$teamId] = (int) round($max * ($n - 1 - $better) / ($n - 1));
        }

        return $points;
    }

    /** Sortierschlüssel (kleiner = besser) für rangbasierte Aufgaben. */
    private function rankKey(array $task, array $sub): ?float
    {
        if ($task['type'] === 'onsite_time') {
            return $sub['raw_value'] !== null ? (float) $sub['raw_value'] : null;
        }

        // numeric_estimate: Abstand zur Zielzahl.
        if ($task['type'] === 'numeric_estimate') {
            $config = TaskModel::decodeConfig($task);
            if (! isset($config['target']) || $sub['answer_number'] === null) {
                return null;
            }

            return abs((float) $sub['answer_number'] - (float) $config['target']);
        }

        return null;
    }
}
