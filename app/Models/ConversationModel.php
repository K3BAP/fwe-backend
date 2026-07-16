<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * `conversations` — polymorphe Chat-Engine (DATA_MODEL §7.1): Gruppen-Channels (`group_channel`,
 * M4), Treffen-Chats (`meetup`) und DMs (`direct`, `dm_key`, M5). Soft-Delete via `deleted_at`.
 * `meetup_uniq` ist eine **generierte** Spalte (nicht beschreibbar → nicht in $allowedFields).
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
        'dm_key',
        'title',
        'position',
        'is_default',
        'min_role',
        'created_by',
        'last_message_at',
        'deleted_at',
    ];
}
