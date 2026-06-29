<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;
use CodeIgniter\Database\RawSql;

/**
 * `group_join_requests` — Beitrittsanträge bei `join_policy='request'` (DATA_MODEL §5.5). Genau **ein**
 * offener `pending`-Antrag je (Gruppe, Nutzer) — app-seitig durchgesetzt (MySQL kennt keinen partiellen
 * Unique-Index, daher nur Index statt UNIQUE über `status`). `decided_by` = der entscheidende Admin/Owner.
 */
class CreateGroupJoinRequests extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'         => ['type' => 'bigint', 'unsigned' => true, 'auto_increment' => true],
            'group_id'   => ['type' => 'bigint', 'unsigned' => true],
            'user_id'    => ['type' => 'bigint', 'unsigned' => true],
            'message'    => ['type' => 'varchar', 'constraint' => 500, 'null' => true],
            'status'     => ['type' => 'enum', 'constraint' => ['pending', 'approved', 'rejected', 'cancelled'], 'default' => 'pending'],
            'decided_by' => ['type' => 'bigint', 'unsigned' => true, 'null' => true],
            'decided_at' => ['type' => 'datetime', 'null' => true],
            'created_at' => ['type' => 'timestamp', 'null' => true, 'default' => new RawSql('CURRENT_TIMESTAMP')],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addKey(['group_id', 'status']); // idx_jr_group_status

        $this->forge->addForeignKey('group_id', 'groups', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('decided_by', 'users', 'id', 'CASCADE', 'SET NULL');

        $this->forge->createTable('group_join_requests', true, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('group_join_requests', true);
    }
}
