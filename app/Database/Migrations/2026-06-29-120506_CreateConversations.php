<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;
use CodeIgniter\Database\RawSql;

/**
 * `conversations` — polymorphe Chat-Engine (DATA_MODEL §7.1). **M4-Teilmenge:** M4 nutzt nur
 * `type='group_channel'` (Gruppen-Channels, ADR-005). Die chat-spezifischen Spalten `dm_key` und das
 * generierte `meetup_uniq` (+ deren UNIQUEs) sowie `conversation_participants`/`messages` kommen erst in
 * **M5** (per ALTER) — in M4 wären sie für Channels stets NULL. `context_id` bewusst **ohne** harten FK
 * (polymorph). Channel-Sichtbarkeit über `min_role`; genau ein nicht löschbarer Default-Channel je Gruppe.
 */
class CreateConversations extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'              => ['type' => 'bigint', 'unsigned' => true, 'auto_increment' => true],
            'type'            => ['type' => 'enum', 'constraint' => ['group_channel', 'meetup', 'direct', 'group_feed']],
            'context_type'    => ['type' => 'enum', 'constraint' => ['group', 'meetup'], 'null' => true],
            'context_id'      => ['type' => 'bigint', 'unsigned' => true, 'null' => true],
            'title'           => ['type' => 'varchar', 'constraint' => 150, 'null' => true],
            'position'        => ['type' => 'smallint', 'unsigned' => true, 'default' => 0],
            'is_default'      => ['type' => 'tinyint', 'constraint' => 1, 'default' => 0],
            'min_role'        => ['type' => 'enum', 'constraint' => ['member', 'admin'], 'default' => 'member'],
            'created_by'      => ['type' => 'bigint', 'unsigned' => true, 'null' => true],
            'created_at'      => ['type' => 'timestamp', 'null' => true, 'default' => new RawSql('CURRENT_TIMESTAMP')],
            'updated_at'      => ['type' => 'timestamp', 'null' => true, 'default' => new RawSql('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')],
            'last_message_at' => ['type' => 'timestamp', 'null' => true],
            'deleted_at'      => ['type' => 'timestamp', 'null' => true],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addKey(['context_type', 'context_id']); // idx_conv_context (Channels einer Gruppe)

        $this->forge->addForeignKey('created_by', 'users', 'id', 'CASCADE', 'SET NULL');

        $this->forge->createTable('conversations', true, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('conversations', true);
    }
}
