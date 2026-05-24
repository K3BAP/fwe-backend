<?php

namespace App\Models;

use CodeIgniter\Model;

class ParticipantModel extends Model
{
    protected $table         = 'participants';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = ['rallye_id', 'team_id', 'display_name', 'token'];

    protected $validationRules = [
        'display_name' => 'required|max_length[80]',
        'rallye_id'    => 'required|is_natural_no_zero',
    ];
    protected $validationMessages = [
        'display_name' => ['required' => 'Bitte gib einen Namen ein.'],
    ];

    public function findByToken(string $token): ?array
    {
        $row = $this->where('token', $token)->first();

        return $row ?: null;
    }
}
