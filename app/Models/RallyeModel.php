<?php

namespace App\Models;

use CodeIgniter\Model;

class RallyeModel extends Model
{
    protected $table         = 'rallyes';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'title', 'description', 'theme', 'join_code', 'status',
        'teams_enabled', 'max_team_size', 'preset_team_count',
        'created_by', 'started_at', 'ended_at',
    ];

    protected $validationRules = [
        'title'     => 'required|max_length[150]',
        'join_code' => 'required|alpha_dash|max_length[32]|is_unique[rallyes.join_code,id,{id}]',
        'status'    => 'in_list[draft,active,finished]',
    ];
    protected $validationMessages = [
        'title'     => ['required' => 'Titel ist erforderlich.'],
        'join_code' => [
            'is_unique'  => 'Dieser Beitritts-Code ist bereits vergeben.',
            'alpha_dash' => 'Der Beitritts-Code darf nur Buchstaben, Zahlen, - und _ enthalten.',
        ],
    ];

    public function findByCode(string $code): ?array
    {
        $row = $this->where('join_code', $code)->first();

        return $row ?: null;
    }

    /**
     * Öffentliche Darstellung (für Beitritts-Screen & Teilnehmer-Kontext) –
     * ohne interne Felder, mit korrekt typisierten Werten.
     *
     * @param array<string,mixed> $rallye
     * @return array<string,mixed>
     */
    public static function publicView(array $rallye): array
    {
        return [
            'id'                => (int) $rallye['id'],
            'title'             => $rallye['title'],
            'description'       => $rallye['description'],
            'theme'             => $rallye['theme'],
            'join_code'         => $rallye['join_code'],
            'status'            => $rallye['status'],
            'teams_enabled'     => (bool) $rallye['teams_enabled'],
            'max_team_size'     => $rallye['max_team_size'] !== null ? (int) $rallye['max_team_size'] : null,
            'preset_team_count' => $rallye['preset_team_count'] !== null ? (int) $rallye['preset_team_count'] : null,
        ];
    }
}
