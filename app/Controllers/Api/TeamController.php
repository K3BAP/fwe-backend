<?php

namespace App\Controllers\Api;

use App\Models\ParticipantModel;
use App\Models\RallyeModel;
use App\Models\TeamModel;

class TeamController extends ApiController
{
    public function index(int $rallyeId)
    {
        if (! $this->participantInRallye($rallyeId)) {
            return $this->failForbidden('Kein Zugriff auf diese Rallye.');
        }

        return $this->respond(['teams' => (new TeamModel())->withMemberCounts($rallyeId)]);
    }

    public function create()
    {
        $participant = $this->currentParticipant();
        $rallye      = (new RallyeModel())->find($participant['rallye_id']);

        if (! $rallye['teams_enabled']) {
            return $this->fail('Für diese Rallye sind keine Teams aktiviert.', 403);
        }
        if ($rallye['preset_team_count'] !== null) {
            return $this->fail('Es können keine neuen Teams erstellt werden – bitte einem vorhandenen Team beitreten.', 403);
        }

        $name      = trim((string) ($this->body()['name'] ?? ''));
        $teamModel = new TeamModel();

        $id = $teamModel->insert([
            'rallye_id' => $rallye['id'],
            'name'      => $name,
            'is_solo'   => 0,
        ]);

        if ($id === false) {
            return $this->failValidationErrors($teamModel->errors());
        }

        (new ParticipantModel())->update($participant['id'], ['team_id' => $id]);

        return $this->respondCreated(['team' => $teamModel->find($id)]);
    }

    public function join(int $teamId)
    {
        $participant = $this->currentParticipant();
        $rallye      = (new RallyeModel())->find($participant['rallye_id']);
        $teamModel   = new TeamModel();
        $team        = $teamModel->find($teamId);

        if ($team === null || (int) $team['rallye_id'] !== (int) $rallye['id']) {
            return $this->failNotFound('Team nicht gefunden.');
        }
        if (! $rallye['teams_enabled']) {
            return $this->fail('Für diese Rallye sind keine Teams aktiviert.', 403);
        }

        $max = $rallye['max_team_size'] !== null ? (int) $rallye['max_team_size'] : null;
        if ($max !== null && $teamModel->memberCount($teamId) >= $max) {
            return $this->fail('Dieses Team ist bereits voll.', 409);
        }

        (new ParticipantModel())->update($participant['id'], ['team_id' => $teamId]);

        return $this->respond(['team' => $team]);
    }

    private function participantInRallye(int $rallyeId): bool
    {
        return (int) $this->currentParticipant()['rallye_id'] === $rallyeId;
    }
}
