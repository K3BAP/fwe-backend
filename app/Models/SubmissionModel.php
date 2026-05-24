<?php

namespace App\Models;

use CodeIgniter\Model;

class SubmissionModel extends Model
{
    protected $table         = 'submissions';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'task_id', 'team_id', 'participant_id',
        'answer_text', 'answer_number', 'answer_choice', 'photo_path', 'raw_value',
        'status', 'awarded_points', 'evaluated_by', 'evaluated_at',
    ];

    public function forTeamTask(int $taskId, int $teamId): ?array
    {
        $row = $this->where('task_id', $taskId)->where('team_id', $teamId)->first();

        return $row ?: null;
    }

    /** Alle Abgaben eines Teams (key = task_id). */
    public function forTeam(int $teamId): array
    {
        $rows = $this->where('team_id', $teamId)->findAll();

        return array_column($rows, null, 'task_id');
    }

    /** Alle Abgaben einer Rallye (über Join auf tasks). */
    public function forRallye(int $rallyeId): array
    {
        return $this->select('submissions.*, tasks.type AS task_type, tasks.max_points AS task_max_points')
            ->join('tasks', 'tasks.id = submissions.task_id')
            ->where('tasks.rallye_id', $rallyeId)
            ->asArray()
            ->findAll();
    }

    /** Abgaben, die auf manuelle Bewertung warten (free_text/photo_upload). */
    public function pendingForRallye(int $rallyeId): array
    {
        return $this->select('submissions.*, tasks.title AS task_title, tasks.type AS task_type, tasks.max_points AS task_max_points, teams.name AS team_name')
            ->join('tasks', 'tasks.id = submissions.task_id')
            ->join('teams', 'teams.id = submissions.team_id')
            ->where('tasks.rallye_id', $rallyeId)
            ->where('submissions.status', 'pending')
            ->orderBy('submissions.submitted_at', 'ASC')
            ->asArray()
            ->findAll();
    }
}
