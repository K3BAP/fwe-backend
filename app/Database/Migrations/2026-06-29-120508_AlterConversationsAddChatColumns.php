<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * M5: erweitert die in M4 angelegte `conversations`-Tabelle um die chat-spezifischen Spalten
 * (DATA_MODEL §7.1): `dm_key` (deterministischer DM-Schlüssel `min:max`, UNIQUE — NULL für
 * Channels/Treffen, mehrfach erlaubt) und die **generierte** Spalte `meetup_uniq` (= `context_id`
 * bei `type='meetup'`, sonst NULL; UNIQUE ⇒ genau ein Chat je Treffen, ADR-012/A3). Plus Index auf
 * `last_message_at` für die Sidebar-Sortierung. Generierte Spalten kann Forge nicht ausdrücken →
 * gezieltes Raw-SQL.
 */
class AlterConversationsAddChatColumns extends Migration
{
    public function up(): void
    {
        $this->forge->addColumn('conversations', [
            'dm_key' => ['type' => 'varchar', 'constraint' => 50, 'null' => true, 'after' => 'context_id'],
        ]);

        $this->db->query('ALTER TABLE `conversations` ADD UNIQUE KEY `uq_conv_dm_key` (`dm_key`)');
        $this->db->query("ALTER TABLE `conversations` ADD COLUMN `meetup_uniq` BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN `type` = 'meetup' THEN `context_id` ELSE NULL END) STORED");
        $this->db->query('ALTER TABLE `conversations` ADD UNIQUE KEY `uq_conv_meetup` (`meetup_uniq`)');
        $this->db->query('ALTER TABLE `conversations` ADD KEY `idx_conv_last` (`last_message_at`)');
    }

    public function down(): void
    {
        $this->db->query('ALTER TABLE `conversations` DROP KEY `idx_conv_last`');
        $this->db->query('ALTER TABLE `conversations` DROP KEY `uq_conv_meetup`');
        $this->db->query('ALTER TABLE `conversations` DROP COLUMN `meetup_uniq`');
        $this->db->query('ALTER TABLE `conversations` DROP KEY `uq_conv_dm_key`');
        $this->forge->dropColumn('conversations', 'dm_key');
    }
}
