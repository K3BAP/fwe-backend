<?php

namespace App\Controllers\Api;

class LeaderboardController extends ApiController
{
    public function index(int $rallyeId)
    {
        if ((int) $this->currentParticipant()['rallye_id'] !== $rallyeId) {
            return $this->failForbidden('Kein Zugriff auf diese Rallye.');
        }

        $board  = service('scoring')->leaderboard($rallyeId);
        $teamId = $this->currentParticipant()['team_id'] !== null
            ? (int) $this->currentParticipant()['team_id'] : null;

        return $this->respond([
            'leaderboard' => $board,
            'my_team_id'  => $teamId,
        ]);
    }

    /** Eigene Team-Ergebnisse (Punkte/Status je Aufgabe + Gesamtpunkte). */
    public function myResults()
    {
        $participant = $this->currentParticipant();
        $teamId      = $participant['team_id'] !== null ? (int) $participant['team_id'] : null;

        if ($teamId === null) {
            return $this->respond(['total' => 0, 'tasks' => []]);
        }

        $computed = service('scoring')->computeRallye((int) $participant['rallye_id'])['teams'];
        $team     = $computed[$teamId] ?? ['total' => 0, 'tasks' => []];

        return $this->respond([
            'total' => $team['total'],
            'tasks' => $team['tasks'],
        ]);
    }
}
