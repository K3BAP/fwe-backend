<?php

namespace App\Controllers\Api\Admin;

use App\Controllers\Api\ApiController;
use App\Models\ParticipantModel;
use App\Models\SubmissionModel;
use App\Models\TaskModel;

class EvaluationController extends ApiController
{
    /** Offene, manuell zu bewertende Abgaben einer Rallye. */
    public function pending(int $rallyeId)
    {
        $rows = (new SubmissionModel())->pendingForRallye($rallyeId);

        foreach ($rows as &$row) {
            $row['photo_url'] = $row['photo_path'] ? site_url('media/photos/' . $row['photo_path']) : null;
        }

        return $this->respond(['pending' => $rows]);
    }

    /** Manuelle Bewertung einer free_text-/photo_upload-Abgabe. */
    public function evaluate(int $submissionId)
    {
        $model = new SubmissionModel();
        $sub   = $model->find($submissionId);
        if ($sub === null) {
            return $this->failNotFound('Abgabe nicht gefunden.');
        }

        $task    = (new TaskModel())->find($sub['task_id']);
        $max     = (int) $task['max_points'];
        $body    = $this->body();
        $correct = (bool) ($body['correct'] ?? false);

        if ($correct) {
            $points = isset($body['points']) ? (int) $body['points'] : $max;
            $points = max(0, min($points, $max));
            $status = 'evaluated';
        } else {
            $points = 0;
            $status = 'incorrect';
        }

        $model->update($submissionId, [
            'status'         => $status,
            'awarded_points' => $points,
            'evaluated_by'   => service('authState')->adminId(),
            'evaluated_at'   => date('Y-m-d H:i:s'),
        ]);

        return $this->respond(['submission' => $model->find($submissionId)]);
    }

    /**
     * On-Site-Eintrag durch die Aufsicht: Team per gescanntem Teilnehmer-Token
     * auflösen und Zeit/Punkte setzen (Upsert, überschreibbar durch Admin).
     */
    public function onsite()
    {
        $body   = $this->body();
        $token  = trim((string) ($body['token'] ?? ''));
        $taskId = (int) ($body['task_id'] ?? 0);
        $value  = $body['value'] ?? null;

        if ($token === '' || $taskId === 0 || ! is_numeric($value)) {
            return $this->failValidationErrors('token, task_id und value (Zahl) sind erforderlich.');
        }

        $participant = (new ParticipantModel())->findByToken($token);
        if ($participant === null) {
            return $this->failNotFound('QR-Code ungültig – Teilnehmer nicht gefunden.');
        }
        if ($participant['team_id'] === null) {
            return $this->fail('Dieser Teilnehmer ist noch keinem Team beigetreten.', 422);
        }

        $task = (new TaskModel())->find($taskId);
        if ($task === null || (int) $task['rallye_id'] !== (int) $participant['rallye_id']) {
            return $this->failNotFound('Aufgabe gehört nicht zu dieser Rallye.');
        }
        if (! in_array($task['type'], TaskModel::ONSITE_TYPES, true)) {
            return $this->fail('Diese Aufgabe ist keine On-Site-Aufgabe.', 422);
        }

        $teamId = (int) $participant['team_id'];
        $max    = (int) $task['max_points'];
        $value  = (float) $value;

        $data = [
            'task_id'        => $taskId,
            'team_id'        => $teamId,
            'raw_value'      => $value,
            'status'         => 'evaluated',
            'evaluated_by'   => service('authState')->adminId(),
            'evaluated_at'   => date('Y-m-d H:i:s'),
            // onsite_points: Rohpunkte direkt (gedeckelt). onsite_time: rangbasiert -> NULL.
            'awarded_points' => $task['type'] === 'onsite_points' ? max(0, min((int) $value, $max)) : null,
        ];

        $model    = new SubmissionModel();
        $existing = $model->forTeamTask($taskId, $teamId);
        if ($existing !== null) {
            $model->update($existing['id'], $data);
            $id = (int) $existing['id'];
        } else {
            $id = (int) $model->insert($data, true);
        }

        return $this->respond([
            'submission' => $model->find($id),
            'team_name'  => (new \App\Models\TeamModel())->find($teamId)['name'] ?? null,
        ]);
    }
}
