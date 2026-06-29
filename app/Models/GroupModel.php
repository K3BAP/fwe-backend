<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * `groups` — Gruppen (DATA_MODEL §5.1). Zeitstempel aus DB-Defaults (`useTimestamps = false`).
 * Listen-/Detail-Queries (Sichtbarkeitsfilter, korrelierte `members_count`-Subquery) leben im GroupService.
 */
class GroupModel extends Model
{
    protected $table         = 'groups';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;

    protected $allowedFields = [
        'slug',
        'name',
        'description',
        'logo_path',
        'region',
        'tags',
        'rules_text',
        'visibility',
        'join_policy',
        'owner_user_id',
        'members_count',
        'deleted_at',
    ];
}
