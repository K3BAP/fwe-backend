<?php

namespace App\Controllers\Api\Admin;

use App\Controllers\Api\ApiController;
use App\Models\TaskModel;

class LeaderboardAdminController extends ApiController
{
    /**
     * Live-Leaderboard inkl. Aufgaben-Aufschlüsselung je Team für die
     * Spielleitung. Liefert die Rangliste, die Aufgabenliste (für Spalten/
     * Labels) und je Team die Punkte/Status pro Aufgabe.
     */
    public function index(int $rallyeId)
    {
        $scoring  = service('scoring');
        $computed = $scoring->computeRallye($rallyeId)['teams'];

        $tasks = array_map(static fn ($t) => [
            'id'         => (int) $t['id'],
            'title'      => $t['title'],
            'type'       => $t['type'],
            'max_points' => (int) $t['max_points'],
        ], (new TaskModel())->forRallye($rallyeId));

        $breakdowns = [];
        foreach ($computed as $teamId => $data) {
            $breakdowns[$teamId] = $data['tasks'];
        }

        return $this->respond([
            'leaderboard' => $scoring->leaderboard($rallyeId),
            'tasks'       => $tasks,
            'breakdowns'  => $breakdowns,
        ]);
    }
}
