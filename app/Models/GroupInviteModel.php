<?php

namespace App\Models;

use CodeIgniter\Model;

/** `group_invites` — Einladungen (gerichtet oder Token-Link, DATA_MODEL §5.6). */
class GroupInviteModel extends Model
{
    protected $table         = 'group_invites';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;

    protected $allowedFields = [
        'group_id',
        'invited_by',
        'invited_user_id',
        'token',
        'status',
        'expires_at',
        'max_uses',
        'uses_count',
    ];
}
