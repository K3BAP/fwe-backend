<?php

namespace App\Models;

use CodeIgniter\Model;

/** `feed_posts` — Gruppen-Feed (DATA_MODEL §5.4). Soft-Delete via `deleted_at`/`deleted_by`. */
class FeedPostModel extends Model
{
    protected $table         = 'feed_posts';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;

    protected $allowedFields = [
        'group_id',
        'author_user_id',
        'title',
        'body',
        'image_path',
        'is_pinned',
        'deleted_at',
        'deleted_by',
    ];
}
