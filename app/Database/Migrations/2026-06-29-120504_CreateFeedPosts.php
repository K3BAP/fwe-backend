<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;
use CodeIgniter\Database\RawSql;

/**
 * `feed_posts` — Gruppen-Feed (DATA_MODEL §5.4). Admin-Broadcast (nur owner/admin posten, serverseitig
 * geprüft); öffentlich lesbar bei `visibility != private`. Sortierung im Read: pinned-first, dann
 * `created_at DESC`. **Soft-Delete** (`deleted_at`/`deleted_by`) ohne Tombstone (anders als Chat) —
 * gelöschte Posts verschwinden aus dem Read.
 */
class CreateFeedPosts extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'             => ['type' => 'bigint', 'unsigned' => true, 'auto_increment' => true],
            'group_id'       => ['type' => 'bigint', 'unsigned' => true],
            'author_user_id' => ['type' => 'bigint', 'unsigned' => true],
            'title'          => ['type' => 'varchar', 'constraint' => 150, 'null' => true],
            'body'           => ['type' => 'text'],
            'image_path'     => ['type' => 'varchar', 'constraint' => 255, 'null' => true],
            'is_pinned'      => ['type' => 'tinyint', 'constraint' => 1, 'default' => 0],
            'created_at'     => ['type' => 'timestamp', 'null' => true, 'default' => new RawSql('CURRENT_TIMESTAMP')],
            'updated_at'     => ['type' => 'timestamp', 'null' => true, 'default' => new RawSql('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')],
            'deleted_at'     => ['type' => 'timestamp', 'null' => true],
            'deleted_by'     => ['type' => 'bigint', 'unsigned' => true, 'null' => true],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addKey(['group_id', 'created_at', 'id']); // idx_feed_keyset

        $this->forge->addForeignKey('group_id', 'groups', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('author_user_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('deleted_by', 'users', 'id', 'CASCADE', 'SET NULL');

        $this->forge->createTable('feed_posts', true, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('feed_posts', true);
    }
}
