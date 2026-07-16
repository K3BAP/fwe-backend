<?php

namespace App\Models;

use CodeIgniter\Model;

/** `group_members` — Mitgliedschafts-Junction (DATA_MODEL §5.2). */
class GroupMemberModel extends Model
{
    protected $table         = 'group_members';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;

    protected $allowedFields = [
        'group_id',
        'user_id',
        'role',
        'status',
    ];
}
