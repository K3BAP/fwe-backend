<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * `messages` — Nachrichten der Chat-Engine (DATA_MODEL §7.3). Eine Nachricht referenziert nur die
 * `conversation_id` (nie direkt Gruppe/Treffen, ADR-005). Soft-Edit (`edited_at`) / Soft-Delete
 * (`deleted_at`+`deleted_by`, Tombstone) statt Hard-Delete. `created_at`/`updated_at` sind
 * **TIMESTAMP(3)** (ms-Präzision für stabilen Sort und `updated_at`-Delta-Polling, ADR-012/A2);
 * `reply_to_id` ist eine self-FK (eine Reply-Ebene, ADR-014). Präzision + self-FK gehen per Raw-SQL,
 * weil Forge sie nicht direkt ausdrücken kann.
 */
class CreateMessages extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'              => ['type' => 'bigint', 'unsigned' => true, 'auto_increment' => true],
            'conversation_id' => ['type' => 'bigint', 'unsigned' => true],
            'sender_id'       => ['type' => 'bigint', 'unsigned' => true],
            'body'            => ['type' => 'text', 'null' => true],
            'reply_to_id'     => ['type' => 'bigint', 'unsigned' => true, 'null' => true],
            'edited_at'       => ['type' => 'datetime', 'null' => true],
            'deleted_at'      => ['type' => 'datetime', 'null' => true],
            'deleted_by'      => ['type' => 'bigint', 'unsigned' => true, 'null' => true],
            'created_at'      => ['type' => 'datetime', 'null' => true],
            'updated_at'      => ['type' => 'datetime', 'null' => true],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addKey(['conversation_id', 'id']);         // idx_msg_keyset (Verlauf + since-Scan)
        $this->forge->addKey(['conversation_id', 'updated_at']); // idx_msg_delta (Polling-Delta)

        $this->forge->addForeignKey('conversation_id', 'conversations', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('sender_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('deleted_by', 'users', 'id', 'CASCADE', 'SET NULL');

        $this->forge->createTable('messages', true, ['ENGINE' => 'InnoDB']);

        // TIMESTAMP(3) + ms-Defaults (Forge kennt keine Präzision) und self-FK reply_to_id → messages.
        $this->db->query('ALTER TABLE `messages` MODIFY `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)');
        $this->db->query('ALTER TABLE `messages` MODIFY `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)');
        $this->db->query('ALTER TABLE `messages` MODIFY `edited_at` TIMESTAMP(3) NULL DEFAULT NULL');
        $this->db->query('ALTER TABLE `messages` MODIFY `deleted_at` TIMESTAMP(3) NULL DEFAULT NULL');
        $this->db->query('ALTER TABLE `messages` ADD CONSTRAINT `fk_msg_reply` FOREIGN KEY (`reply_to_id`) REFERENCES `messages`(`id`) ON DELETE SET NULL');
    }

    public function down(): void
    {
        $this->forge->dropTable('messages', true);
    }
}
