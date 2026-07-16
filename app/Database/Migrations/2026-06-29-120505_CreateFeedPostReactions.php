<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;
use CodeIgniter\Database\RawSql;

/**
 * `feed_post_reactions` — Emoji-Reaktionen auf Feed-Posts (DATA_MODEL §5.4.1). Eingeloggte Mitglieder;
 * `UNIQUE(feed_post_id,user_id,emoji)` = ein Emoji pro Nutzer pro Post (Toggle). Aggregation im Read zu
 * `{ emoji, count, me }`. Die `emoji`-Spalte braucht eine **binäre** Kollation (`utf8mb4_bin`): unter
 * `utf8mb4_general_ci` gelten verschiedene Emojis als gleich (👍 == 🔥), was den Unique-Key fälschlich
 * auslösen würde, sobald ein Nutzer mit zwei verschiedenen Emojis reagiert.
 */
class CreateFeedPostReactions extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'           => ['type' => 'bigint', 'unsigned' => true, 'auto_increment' => true],
            'feed_post_id' => ['type' => 'bigint', 'unsigned' => true],
            'user_id'      => ['type' => 'bigint', 'unsigned' => true],
            'emoji'        => ['type' => 'varchar', 'constraint' => 16],
            'created_at'   => ['type' => 'timestamp', 'null' => true, 'default' => new RawSql('CURRENT_TIMESTAMP')],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['feed_post_id', 'user_id', 'emoji']); // uq_feed_reaction
        $this->forge->addKey('feed_post_id');                              // idx_feed_react_post

        $this->forge->addForeignKey('feed_post_id', 'feed_posts', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');

        $this->forge->createTable('feed_post_reactions', true, ['ENGINE' => 'InnoDB']);

        // emoji binär kollationieren, damit verschiedene Emojis im Unique-Key unterscheidbar bleiben.
        $this->db->query('ALTER TABLE `feed_post_reactions` MODIFY `emoji` VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL');
    }

    public function down(): void
    {
        $this->forge->dropTable('feed_post_reactions', true);
    }
}
