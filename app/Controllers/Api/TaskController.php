<?php

namespace App\Controllers\Api;

use App\Models\SubmissionModel;
use App\Models\TaskModel;

class TaskController extends ApiController
{
    /**
     * Aufgabenliste für den Teilnehmer – Lösungen/Korrektantworten entfernt,
     * inkl. Abgabestatus & Punkte des eigenen Teams.
     */
    public function forParticipant(int $rallyeId)
    {
        $participant = $this->currentParticipant();
        if ((int) $participant['rallye_id'] !== $rallyeId) {
            return $this->failForbidden('Kein Zugriff auf diese Rallye.');
        }

        $teamId = $participant['team_id'] !== null ? (int) $participant['team_id'] : null;
        $tasks  = (new TaskModel())->forRallye($rallyeId);

        $submissions = [];
        $breakdown   = [];
        if ($teamId !== null) {
            $submissions = (new SubmissionModel())->forTeam($teamId);
            $breakdown   = service('scoring')->teamBreakdown($rallyeId, $teamId);
        }

        $out = [];
        foreach ($tasks as $task) {
            $taskId = (int) $task['id'];
            $sub    = $submissions[$taskId] ?? null;
            $score  = $breakdown[$taskId] ?? null;

            $out[] = [
                'id'         => $taskId,
                'type'       => $task['type'],
                'title'      => $task['title'],
                'prompt'     => $task['prompt'],
                'position'   => (int) $task['position'],
                'max_points' => (int) $task['max_points'],
                'options'    => $this->publicOptions($task),
                'submission' => $sub === null ? null : [
                    'status'        => $score['status'] ?? $sub['status'],
                    'points'        => $score['points'] ?? null,
                    'answer_text'   => $sub['answer_text'],
                    'answer_number' => $sub['answer_number'],
                    'answer_choice' => $sub['answer_choice'] !== null ? (int) $sub['answer_choice'] : null,
                    'has_photo'     => ! empty($sub['photo_path']),
                    'submitted_at'  => $sub['submitted_at'],
                ],
            ];
        }

        return $this->respond(['tasks' => $out]);
    }

    /** Nur für den Teilnehmer sichtbare config-Anteile (z. B. MC-Antwortoptionen). */
    private function publicOptions(array $task): ?array
    {
        if ($task['type'] !== 'multiple_choice') {
            return null;
        }

        $config = TaskModel::decodeConfig($task);

        return array_values($config['choices'] ?? []);
    }
}
