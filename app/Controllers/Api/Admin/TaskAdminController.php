<?php

namespace App\Controllers\Api\Admin;

use App\Controllers\Api\ApiController;
use App\Models\RallyeModel;
use App\Models\TaskModel;

class TaskAdminController extends ApiController
{
    public function index(int $rallyeId)
    {
        $tasks = (new TaskModel())->forRallye($rallyeId);
        foreach ($tasks as &$t) {
            $t['config'] = TaskModel::decodeConfig($t);
        }

        return $this->respond(['tasks' => $tasks]);
    }

    public function create(int $rallyeId)
    {
        if ((new RallyeModel())->find($rallyeId) === null) {
            return $this->failNotFound('Rallye nicht gefunden.');
        }

        $body = $this->body();
        $type = (string) ($body['type'] ?? '');

        [$config, $error] = $this->buildConfig($type, $body);
        if ($error !== null) {
            return $this->failValidationErrors($error);
        }

        $model = new TaskModel();
        $data  = $this->baseFields($body, $rallyeId, $type);
        $data['config'] = $config !== null ? json_encode($config) : null;

        $id = $model->insert($data);
        if ($id === false) {
            return $this->failValidationErrors($model->errors());
        }

        return $this->respondCreated(['task' => $this->present($model->find($id))]);
    }

    public function update(int $taskId)
    {
        $model = new TaskModel();
        $task  = $model->find($taskId);
        if ($task === null) {
            return $this->failNotFound('Aufgabe nicht gefunden.');
        }

        $body = $this->body();
        $type = (string) ($body['type'] ?? $task['type']);

        [$config, $error] = $this->buildConfig($type, $body);
        if ($error !== null) {
            return $this->failValidationErrors($error);
        }

        $data = $this->baseFields($body, (int) $task['rallye_id'], $type);
        $data['config'] = $config !== null ? json_encode($config) : null;

        if (! $model->update($taskId, $data)) {
            return $this->failValidationErrors($model->errors());
        }

        return $this->respond(['task' => $this->present($model->find($taskId))]);
    }

    public function delete(int $taskId)
    {
        $model = new TaskModel();
        if ($model->find($taskId) === null) {
            return $this->failNotFound('Aufgabe nicht gefunden.');
        }
        $model->delete($taskId);

        return $this->respondDeleted(['id' => $taskId]);
    }

    /** @param array<string,mixed> $body */
    private function baseFields(array $body, int $rallyeId, string $type): array
    {
        return [
            'rallye_id'  => $rallyeId,
            'type'       => $type,
            'title'      => trim((string) ($body['title'] ?? '')),
            'prompt'     => isset($body['prompt']) ? trim((string) $body['prompt']) : null,
            'position'   => (int) ($body['position'] ?? 0),
            'max_points' => (int) ($body['max_points'] ?? 10),
        ];
    }

    private function present(array $task): array
    {
        $task['config'] = TaskModel::decodeConfig($task);

        return $task;
    }

    /**
     * Baut & validiert das config-Objekt je Aufgabentyp.
     *
     * @return array{0: array|null, 1: string|null} [config, fehlertext]
     */
    private function buildConfig(string $type, array $body): array
    {
        $c = is_array($body['config'] ?? null) ? $body['config'] : [];

        switch ($type) {
            case 'multiple_choice':
                $choices = array_values(array_filter(
                    array_map(static fn ($v) => trim((string) $v), $c['choices'] ?? []),
                    static fn ($v) => $v !== '',
                ));
                if (count($choices) < 2) {
                    return [null, 'Bitte mindestens zwei Antwortoptionen angeben.'];
                }
                $idx = (int) ($c['correct_index'] ?? -1);
                if ($idx < 0 || $idx >= count($choices)) {
                    return [null, 'Bitte die korrekte Antwort markieren.'];
                }

                return [['choices' => $choices, 'correct_index' => $idx], null];

            case 'exact_text':
                $accepted = array_values(array_filter(
                    array_map(static fn ($v) => trim((string) $v), $c['accepted'] ?? []),
                    static fn ($v) => $v !== '',
                ));
                if ($accepted === []) {
                    return [null, 'Bitte mindestens eine akzeptierte Antwort angeben.'];
                }

                return [['accepted' => $accepted], null];

            case 'numeric_estimate':
                if (! isset($c['target']) || ! is_numeric($c['target'])) {
                    return [null, 'Bitte einen Zielwert (Zahl) angeben.'];
                }

                return [['target' => (float) $c['target'], 'tolerance' => (float) ($c['tolerance'] ?? 0)], null];

            case 'free_text':
                $samples = array_values(array_filter(
                    array_map(static fn ($v) => trim((string) $v), $c['sample_solutions'] ?? []),
                    static fn ($v) => $v !== '',
                ));

                return [['sample_solutions' => $samples], null];

            case 'gps_checkin':
                if (! isset($c['lat'], $c['lng']) || ! is_numeric($c['lat']) || ! is_numeric($c['lng'])) {
                    return [null, 'Bitte gültige Koordinaten (lat/lng) angeben.'];
                }

                return [[
                    'lat'      => (float) $c['lat'],
                    'lng'      => (float) $c['lng'],
                    'radius_m' => max(1, (int) ($c['radius_m'] ?? 50)),
                ], null];

            case 'photo_upload':
            case 'onsite_time':
            case 'onsite_points':
                return [null, null];
        }

        return [null, 'Unbekannter Aufgabentyp.'];
    }
}
