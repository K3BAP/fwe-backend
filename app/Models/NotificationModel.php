<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * `notifications` — In-App-Benachrichtigungen (DATA_MODEL §8.1). `created_at` aus DB-Default;
 * `read_at = NULL` ⇒ ungelesen. `data` ist JSON (Render-Payload) — der NotificationPresenter baut
 * daraus `text`/`link`. Casts halten `data` als Array.
 */
class NotificationModel extends Model
{
    protected $table         = 'notifications';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;

    protected $allowedFields = [
        'user_id',
        'type',
        'actor_user_id',
        'context_type',
        'context_id',
        'data',
        'read_at',
    ];
}
