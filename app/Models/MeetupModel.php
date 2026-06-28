<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * `meetups` — Flugtreffen (DATA_MODEL §4.2). Zeitstempel kommen aus DB-Defaults
 * (CURRENT_TIMESTAMP / ON UPDATE), daher `useTimestamps = false`. Die Listen-/Detail-Queries
 * (korrelierte participant_count-Subquery, Filter/Sort) leben im MeetupService.
 */
class MeetupModel extends Model
{
    protected $table         = 'meetups';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;

    protected $allowedFields = [
        'creator_user_id',
        'spot_id',
        'spot_name',
        'region',
        'lat',
        'lng',
        'title',
        'description',
        'starts_at',
        'experience_level',
        'max_participants',
        'status',
        'visibility',
        'group_id',
    ];
}
