<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * `profiles` (1:1 zu Shield-`users`). Der Primärschlüssel **ist** der FK `user_id` (nicht
 * auto-increment), wird also beim Anlegen explizit gesetzt. Zeitstempel kommen aus DB-Defaults
 * (CURRENT_TIMESTAMP / ON UPDATE), daher `useTimestamps = false`.
 */
class ProfileModel extends Model
{
    protected $table            = 'profiles';
    protected $primaryKey       = 'user_id';
    protected $useAutoIncrement = false;
    protected $returnType       = 'array';
    protected $useTimestamps    = false;

    protected $allowedFields = [
        'user_id',
        'display_name',
        'handle',
        'bio_markdown',
        'avatar_path',
        'experience_level',
        'license_class',
        'glider',
        'home_region',
        'flight_hours',
    ];
}
