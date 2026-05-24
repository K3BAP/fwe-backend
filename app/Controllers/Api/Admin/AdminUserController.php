<?php

namespace App\Controllers\Api\Admin;

use App\Controllers\Api\ApiController;
use App\Models\AdminModel;

class AdminUserController extends ApiController
{
    public function index()
    {
        $admins = (new AdminModel())->select('id, username, created_at')->orderBy('username')->findAll();

        return $this->respond(['admins' => $admins]);
    }

    public function create()
    {
        $body     = $this->body();
        $username = trim((string) ($body['username'] ?? ''));
        $password = (string) ($body['password'] ?? '');

        if (strlen($password) < 6) {
            return $this->failValidationErrors('Das Passwort muss mindestens 6 Zeichen lang sein.');
        }

        $model = new AdminModel();
        $id    = $model->insert([
            'username'      => $username,
            'password_hash' => password_hash($password, PASSWORD_BCRYPT),
        ]);

        if ($id === false) {
            return $this->failValidationErrors($model->errors());
        }

        return $this->respondCreated(['admin' => ['id' => $id, 'username' => $username]]);
    }

    public function delete(int $id)
    {
        $model = new AdminModel();
        if ($model->find($id) === null) {
            return $this->failNotFound('Admin nicht gefunden.');
        }
        if ((int) $id === service('authState')->adminId()) {
            return $this->fail('Du kannst dein eigenes Konto nicht löschen.', 422);
        }
        $model->delete($id);

        return $this->respondDeleted(['id' => $id]);
    }
}
