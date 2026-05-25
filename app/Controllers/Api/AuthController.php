<?php

namespace App\Controllers\Api;

use App\Models\ParticipantModel;
use App\Models\RallyeModel;
use App\Models\TeamModel;
use App\Services\AuthService;

class AuthController extends ApiController
{
    public function login()
    {
        $data     = $this->body();
        $username = trim((string) ($data['username'] ?? ''));
        $password = (string) ($data['password'] ?? '');

        if ($username === '' || $password === '') {
            return $this->failValidationErrors('Benutzername und Passwort sind erforderlich.');
        }

        $result = (new AuthService())->adminLogin($username, $password);

        if ($result === null) {
            return $this->failUnauthorized('Benutzername oder Passwort ist falsch.');
        }

        return $this->respond($result);
    }

    public function logout()
    {
        $header = $this->request->getHeaderLine('Authorization');
        if (preg_match('/^Bearer\s+(.+)$/i', $header, $m) === 1) {
            (new AuthService())->adminLogout(trim($m[1]));
        }

        return $this->respondNoContent();
    }

    public function adminMe()
    {
        return $this->respond(['admin' => $this->currentAdmin()]);
    }

    /** Teilnehmer tritt einer Rallye bei (per join_code). */
    public function join(string $code)
    {
        $rallye = (new RallyeModel())->findByCode($code);

        if ($rallye === null) {
            return $this->failNotFound('Rallye nicht gefunden.');
        }
        if ($rallye['status'] !== 'active') {
            return $this->fail('Diese Rallye ist derzeit nicht aktiv.', 403);
        }

        $name = trim((string) ($this->body()['display_name'] ?? ''));
        if ($name === '') {
            return $this->failValidationErrors('Bitte gib einen Namen ein.');
        }

        $result = (new AuthService())->joinRallye($rallye, $name);

        return $this->respondCreated([
            'token'       => $result['token'],
            'participant' => $result['participant'],
            'rallye'      => RallyeModel::publicView($rallye),
        ]);
    }

    /** Kontext des aktuell eingeloggten Teilnehmers. */
    public function me()
    {
        $participant = $this->currentParticipant();
        $rallye      = (new RallyeModel())->find($participant['rallye_id']);
        $teamModel   = new TeamModel();
        $team        = $participant['team_id'] ? $teamModel->find($participant['team_id']) : null;
        if ($team) {
            $team['member_count'] = $teamModel->memberCount((int) $team['id']);
        }

        return $this->respond([
            'participant' => $participant,
            'rallye'      => RallyeModel::publicView($rallye),
            'team'        => $team,
        ]);
    }
}
