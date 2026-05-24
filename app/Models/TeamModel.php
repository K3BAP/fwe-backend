<?php

namespace App\Models;

use CodeIgniter\Model;

class TeamModel extends Model
{
    protected $table         = 'teams';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = ['rallye_id', 'name', 'is_solo'];

    protected $validationRules = [
        'name'      => 'required|max_length[100]',
        'rallye_id' => 'required|is_natural_no_zero',
    ];
    protected $validationMessages = [
        'name' => ['required' => 'Teamname ist erforderlich.'],
    ];

    /** Teams einer Rallye inkl. Mitgliederzahl (Solo-Teams ausgeblendet). */
    public function withMemberCounts(int $rallyeId): array
    {
        return $this->select('teams.id, teams.name, teams.is_solo, COUNT(participants.id) AS member_count')
            ->join('participants', 'participants.team_id = teams.id', 'left')
            ->where('teams.rallye_id', $rallyeId)
            ->where('teams.is_solo', 0)
            ->groupBy('teams.id')
            ->orderBy('teams.name', 'ASC')
            ->asArray()
            ->findAll();
    }

    public function memberCount(int $teamId): int
    {
        return (new ParticipantModel())->where('team_id', $teamId)->countAllResults();
    }
}
