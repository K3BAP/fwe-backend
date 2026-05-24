<?php

namespace App\Controllers\Api\Admin;

use App\Controllers\Api\ApiController;
use App\Models\RallyeModel;

class RallyeAdminController extends ApiController
{
    public function index()
    {
        $rallyes = (new RallyeModel())->orderBy('created_at', 'DESC')->findAll();

        return $this->respond(['rallyes' => $rallyes]);
    }

    public function show(int $id)
    {
        $rallye = (new RallyeModel())->find($id);
        if ($rallye === null) {
            return $this->failNotFound('Rallye nicht gefunden.');
        }

        return $this->respond(['rallye' => $rallye]);
    }

    public function create()
    {
        $body  = $this->body();
        $model = new RallyeModel();

        $data = $this->sanitize($body);
        $data['join_code']  = $data['join_code'] !== '' ? $data['join_code'] : $this->generateCode($data['title']);
        $data['created_by'] = service('authState')->adminId();
        $data['status']     = 'draft';

        $id = $model->insert($data);
        if ($id === false) {
            return $this->failValidationErrors($model->errors());
        }

        return $this->respondCreated(['rallye' => $model->find($id)]);
    }

    public function update(int $id)
    {
        $model = new RallyeModel();
        if ($model->find($id) === null) {
            return $this->failNotFound('Rallye nicht gefunden.');
        }

        if (! $model->update($id, $this->sanitize($this->body()))) {
            return $this->failValidationErrors($model->errors());
        }

        return $this->respond(['rallye' => $model->find($id)]);
    }

    public function setStatus(int $id)
    {
        $model  = new RallyeModel();
        $rallye = $model->find($id);
        if ($rallye === null) {
            return $this->failNotFound('Rallye nicht gefunden.');
        }

        $status = (string) ($this->body()['status'] ?? '');
        if (! in_array($status, ['draft', 'active', 'finished'], true)) {
            return $this->failValidationErrors('Ungültiger Status.');
        }

        $update = ['status' => $status];
        if ($status === 'active' && empty($rallye['started_at'])) {
            $update['started_at'] = date('Y-m-d H:i:s');
        }
        if ($status === 'finished') {
            $update['ended_at'] = date('Y-m-d H:i:s');
        }

        $model->update($id, $update);

        return $this->respond(['rallye' => $model->find($id)]);
    }

    public function delete(int $id)
    {
        $model = new RallyeModel();
        if ($model->find($id) === null) {
            return $this->failNotFound('Rallye nicht gefunden.');
        }
        $model->delete($id);

        return $this->respondDeleted(['id' => $id]);
    }

    /** @param array<string,mixed> $body */
    private function sanitize(array $body): array
    {
        $data = [];
        foreach (['title', 'description', 'theme', 'join_code'] as $key) {
            if (array_key_exists($key, $body)) {
                $data[$key] = is_string($body[$key]) ? trim($body[$key]) : $body[$key];
            }
        }
        if (array_key_exists('teams_enabled', $body)) {
            $data['teams_enabled'] = $body['teams_enabled'] ? 1 : 0;
        }
        foreach (['max_team_size', 'preset_team_count'] as $key) {
            if (array_key_exists($key, $body)) {
                $data[$key] = $body[$key] !== null && $body[$key] !== '' ? (int) $body[$key] : null;
            }
        }

        return $data;
    }

    private function generateCode(string $title): string
    {
        helper('text');
        $base  = url_title($title, '-', true);
        $base  = $base !== '' ? substr($base, 0, 20) : 'rallye';
        $model = new RallyeModel();
        $code  = $base;

        while ($model->where('join_code', $code)->countAllResults() > 0) {
            $code = $base . '-' . bin2hex(random_bytes(2));
        }

        return $code;
    }
}
