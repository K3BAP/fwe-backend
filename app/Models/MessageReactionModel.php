<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * `message_reactions` — Emoji-Reaktionen (DATA_MODEL §7.4). `created_at` aus DB-Default; `emoji`
 * binär kollationiert (utf8mb4_bin, s. Migration). Aggregation/Toggle im ChatService.
 */
class MessageReactionModel extends Model
{
    protected $table         = 'message_reactions';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;

    protected $allowedFields = [
        'message_id',
        'user_id',
        'emoji',
    ];
}
