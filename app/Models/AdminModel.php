<?php

namespace App\Models;

use CodeIgniter\Model;

class AdminModel extends Model
{
    protected $table         = 'admins';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $allowedFields = ['username', 'password_hash'];
    protected $useTimestamps = false;

    protected $validationRules = [
        'username' => 'required|min_length[3]|max_length[64]|is_unique[admins.username,id,{id}]',
    ];
    protected $validationMessages = [
        'username' => [
            'is_unique' => 'Dieser Benutzername ist bereits vergeben.',
            'required'  => 'Benutzername ist erforderlich.',
        ],
    ];
}
