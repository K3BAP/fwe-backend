<?php

namespace App\Controllers\Api;

use App\Models\SubmissionModel;
use App\Models\TaskModel;

class SubmissionController extends ApiController
{
    /** Teilnehmer gibt eine Antwort ab (unveränderlich). */
    public function submit(int $taskId)
    {
        $participant = $this->currentParticipant();
        $teamId      = $participant['team_id'] !== null ? (int) $participant['team_id'] : null;

        if ($teamId === null) {
            return $this->fail('Bitte tritt zuerst einem Team bei.', 403);
        }

        $task = (new TaskModel())->find($taskId);
        if ($task === null || (int) $task['rallye_id'] !== (int) $participant['rallye_id']) {
            return $this->failNotFound('Aufgabe nicht gefunden.');
        }
        if (in_array($task['type'], TaskModel::ONSITE_TYPES, true)) {
            return $this->fail('Diese Aufgabe wird vor Ort durch die Aufsicht bewertet.', 422);
        }
        if ($task['type'] === 'photo_upload') {
            return $this->fail('Für diese Aufgabe bitte ein Foto hochladen.', 422);
        }

        $submissionModel = new SubmissionModel();
        if ($submissionModel->forTeamTask($taskId, $teamId) !== null) {
            return $this->fail('Für diese Aufgabe wurde bereits eine Antwort abgegeben.', 409);
        }

        $body   = $this->body();
        $graded = service('grading')->grade($task, $body);

        $data = [
            'task_id'        => $taskId,
            'team_id'        => $teamId,
            'participant_id' => $participant['id'],
            'answer_text'    => $body['answer_text']   ?? null,
            'answer_number'  => isset($body['answer_number']) ? (float) $body['answer_number'] : null,
            'answer_choice'  => isset($body['answer_choice']) ? (int) $body['answer_choice'] : null,
            'status'         => $graded['status'],
            'awarded_points' => $graded['awarded_points'],
        ];

        $id = $submissionModel->insert($data, true);

        return $this->respondCreated($this->feedback($task, (int) $id, $teamId));
    }

    /** Foto-Upload für photo_upload-Aufgaben (multipart). */
    public function uploadPhoto(int $taskId)
    {
        $participant = $this->currentParticipant();
        $teamId      = $participant['team_id'] !== null ? (int) $participant['team_id'] : null;

        if ($teamId === null) {
            return $this->fail('Bitte tritt zuerst einem Team bei.', 403);
        }

        $task = (new TaskModel())->find($taskId);
        if ($task === null || (int) $task['rallye_id'] !== (int) $participant['rallye_id']) {
            return $this->failNotFound('Aufgabe nicht gefunden.');
        }
        if ($task['type'] !== 'photo_upload') {
            return $this->fail('Diese Aufgabe erwartet kein Foto.', 422);
        }

        $submissionModel = new SubmissionModel();
        if ($submissionModel->forTeamTask($taskId, $teamId) !== null) {
            return $this->fail('Für diese Aufgabe wurde bereits ein Foto abgegeben.', 409);
        }

        $file = $this->request->getFile('photo');
        if ($file === null || ! $file->isValid()) {
            return $this->failValidationErrors('Es wurde kein gültiges Foto übermittelt.');
        }
        if (! in_array($file->getMimeType(), ['image/jpeg', 'image/png', 'image/webp', 'image/heic'], true)) {
            return $this->failValidationErrors('Nur JPEG-, PNG-, WebP- oder HEIC-Bilder sind erlaubt.');
        }

        $dir = WRITEPATH . 'uploads';
        if (! is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $newName = $file->getRandomName();
        $file->move($dir, $newName);

        $id = $submissionModel->insert([
            'task_id'        => $taskId,
            'team_id'        => $teamId,
            'participant_id' => $participant['id'],
            'photo_path'     => $newName,
            'status'         => 'pending',
        ], true);

        return $this->respondCreated($this->feedback($task, (int) $id, $teamId));
    }

    /**
     * Sofort-Feedback nach der Abgabe (für rangbasierte Typen mit aktuell
     * berechneten Punkten).
     */
    private function feedback(array $task, int $submissionId, int $teamId): array
    {
        $sub       = (new SubmissionModel())->find($submissionId);
        $breakdown = service('scoring')->teamBreakdown((int) $task['rallye_id'], $teamId);
        $score     = $breakdown[(int) $task['id']] ?? null;

        return [
            'submission' => [
                'id'     => $submissionId,
                'status' => $score['status'] ?? $sub['status'],
                'points' => $score['points'] ?? null,
            ],
            'instant' => in_array($task['type'], TaskModel::AUTO_TYPES, true),
        ];
    }
}
