<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * `conversation_participants` — Teilnehmer + Ungelesen-Watermark (DATA_MODEL §7.2). `joined_at` kommt
 * aus dem DB-Default, daher `useTimestamps = false`.
 */
class ConversationParticipantModel extends Model
{
    protected $table         = 'conversation_participants';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;

    protected $allowedFields = [
        'conversation_id',
        'user_id',
        'role',
        'last_read_message_id',
        'last_read_at',
        'muted',
    ];
}
