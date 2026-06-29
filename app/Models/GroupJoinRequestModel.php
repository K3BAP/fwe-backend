<?php

namespace App\Models;

use CodeIgniter\Model;

/** `group_join_requests` — Beitrittsanträge (DATA_MODEL §5.5). */
class GroupJoinRequestModel extends Model
{
    protected $table         = 'group_join_requests';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;

    protected $allowedFields = [
        'group_id',
        'user_id',
        'message',
        'status',
        'decided_by',
        'decided_at',
    ];
}
