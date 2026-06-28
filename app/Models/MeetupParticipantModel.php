<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * `meetup_participants` — Teilnahme-Junction (DATA_MODEL §4.3, ADR-015). Schlank: nur die Beziehung
 * `meetup_id`↔`user_id`. `joined_at` via DB-Default.
 */
class MeetupParticipantModel extends Model
{
    protected $table         = 'meetup_participants';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;

    protected $allowedFields = [
        'meetup_id',
        'user_id',
    ];
}
