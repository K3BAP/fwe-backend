<?php

namespace App\Models;

use CodeIgniter\Model;

/** `feed_post_reactions` — Emoji-Reaktionen auf Feed-Posts (DATA_MODEL §5.4.1). */
class FeedPostReactionModel extends Model
{
    protected $table         = 'feed_post_reactions';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;

    protected $allowedFields = [
        'feed_post_id',
        'user_id',
        'emoji',
    ];
}
