<?php

namespace App\Services;

use App\Models\AdminModel;
use App\Models\AdminTokenModel;
use App\Models\ParticipantModel;
use App\Models\TeamModel;

class AuthService
{
    public static function newToken(): string
    {
        return bin2hex(random_bytes(24));
    }

    /**
     * Prüft Admin-Zugangsdaten und stellt bei Erfolg einen Token aus.
     *
     * @return array{token:string, admin:array}|null
     */
    public function adminLogin(string $username, string $password): ?array
    {
        $admin = (new AdminModel())->where('username', $username)->first();

        if ($admin === null || ! password_verify($password, $admin['password_hash'])) {
            return null;
        }

        $token = self::newToken();
        (new AdminTokenModel())->insert([
            'admin_id'   => $admin['id'],
            'token'      => $token,
            'expires_at' => null,
        ]);

        unset($admin['password_hash']);

        return ['token' => $token, 'admin' => $admin];
    }

    public function adminLogout(string $token): void
    {
        (new AdminTokenModel())->where('token', $token)->delete();
    }

    /**
     * Legt einen Teilnehmer on-the-fly an. Bei deaktivierten Teams wird ein
     * unsichtbares Solo-Team erzeugt und zugewiesen.
     *
     * @param array<string,mixed> $rallye
     * @return array{token:string, participant:array}
     */
    public function joinRallye(array $rallye, string $displayName): array
    {
        $participantModel = new ParticipantModel();
        $token            = self::newToken();

        $teamId = null;
        if (! $rallye['teams_enabled']) {
            $teamId = (new TeamModel())->insert([
                'rallye_id' => $rallye['id'],
                'name'      => $displayName,
                'is_solo'   => 1,
            ], true);
        }

        $id = $participantModel->insert([
            'rallye_id'    => $rallye['id'],
            'team_id'      => $teamId,
            'display_name' => $displayName,
            'token'        => $token,
        ], true);

        return ['token' => $token, 'participant' => $participantModel->find($id)];
    }

    /** Stellt einen neuen Token für einen bestehenden Teilnehmer aus (Login-Link-Recovery). */
    public function reissueToken(int $participantId): ?string
    {
        $model = new ParticipantModel();
        if ($model->find($participantId) === null) {
            return null;
        }

        $token = self::newToken();
        $model->update($participantId, ['token' => $token]);

        return $token;
    }
}
