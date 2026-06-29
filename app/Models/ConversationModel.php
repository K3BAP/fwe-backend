<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * `conversations` — polymorphe Chat-Engine (DATA_MODEL §7.1). In M4 nur `type='group_channel'`
 * (Gruppen-Channels); Messages/DM-Spalten kommen in M5. Soft-Delete via `deleted_at`.
 */
class ConversationModel extends Model
{
    protected $table         = 'conversations';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;

    protected $allowedFields = [
        'type',
        'context_type',
        'context_id',
        'title',
        'position',
        'is_default',
        'min_role',
        'created_by',
        'last_message_at',
        'deleted_at',
    ];
}
