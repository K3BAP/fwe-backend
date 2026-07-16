<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * `spots` — kuratierte Startplätze (read-only, ADR-007/012-A4). Zeitstempel via DB-Default.
 */
class SpotModel extends Model
{
    protected $table         = 'spots';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;

    protected $allowedFields = [
        'name',
        'region',
        'country',
        'lat',
        'lng',
        'type',
        'description',
    ];
}
