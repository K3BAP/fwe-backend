<?php

namespace App\Controllers\Api\Admin;

use App\Controllers\Api\ApiController;
use App\Models\ParticipantModel;
use App\Services\AuthService;

class ParticipantAdminController extends ApiController
{
    public function index(int $rallyeId)
    {
        $rows = (new ParticipantModel())
            ->select('participants.id, participants.display_name, participants.team_id, participants.created_at, teams.name AS team_name')
            ->join('teams', 'teams.id = participants.team_id', 'left')
            ->where('participants.rallye_id', $rallyeId)
            ->orderBy('participants.created_at', 'ASC')
            ->asArray()
            ->findAll();

        return $this->respond(['participants' => $rows]);
    }

    /** Neuen Token (Login-Link) für einen Teilnehmer ausstellen. */
    public function reissue(int $participantId)
    {
        $token = (new AuthService())->reissueToken($participantId);
        if ($token === null) {
            return $this->failNotFound('Teilnehmer nicht gefunden.');
        }

        return $this->respond(['token' => $token]);
    }
}
