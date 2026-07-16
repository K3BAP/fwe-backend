<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * `messages` — Nachrichten der Chat-Engine (DATA_MODEL §7.3). Zeitstempel kommen aus DB-Defaults
 * (`created_at`/`updated_at` TIMESTAMP(3); `updated_at` mit ON UPDATE für das Polling-Delta), daher
 * `useTimestamps = false`. Aggregierte Reads (Reaktionen, Reply-Previews) leben im ChatService.
 */
class MessageModel extends Model
{
    protected $table         = 'messages';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;

    protected $allowedFields = [
        'conversation_id',
        'sender_id',
        'body',
        'reply_to_id',
        'edited_at',
        'deleted_at',
        'deleted_by',
    ];
}
