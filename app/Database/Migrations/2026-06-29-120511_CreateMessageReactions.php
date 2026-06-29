<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;
use CodeIgniter\Database\RawSql;

/**
 * `message_reactions` — Emoji-Reaktionen auf Nachrichten (DATA_MODEL §7.4, ADR-009).
 * `UNIQUE(message_id,user_id,emoji)` = ein Emoji pro Nutzer pro Nachricht (Toggle); Aggregation im
 * Read zu `{ emoji, count, me }`. Wie bei `feed_post_reactions` braucht `emoji` die binäre Kollation
 * `utf8mb4_bin`: unter `utf8mb4_general_ci` gälten verschiedene Emojis als gleich (👍 == 🔥) und der
 * Unique-Key würde fälschlich auslösen.
 */
class CreateMessageReactions extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'         => ['type' => 'bigint', 'unsigned' => true, 'auto_increment' => true],
            'message_id' => ['type' => 'bigint', 'unsigned' => true],
            'user_id'    => ['type' => 'bigint', 'unsigned' => true],
            'emoji'      => ['type' => 'varchar', 'constraint' => 16],
            'created_at' => ['type' => 'timestamp', 'null' => true, 'default' => new RawSql('CURRENT_TIMESTAMP')],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['message_id', 'user_id', 'emoji']); // uq_reaction
        $this->forge->addKey('message_id');                             // idx_react_msg

        $this->forge->addForeignKey('message_id', 'messages', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');

        $this->forge->createTable('message_reactions', true, ['ENGINE' => 'InnoDB']);

        $this->db->query('ALTER TABLE `message_reactions` MODIFY `emoji` VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL');
    }

    public function down(): void
    {
        $this->forge->dropTable('message_reactions', true);
    }
}
