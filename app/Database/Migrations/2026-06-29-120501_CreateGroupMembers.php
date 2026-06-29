<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;
use CodeIgniter\Database\RawSql;

/**
 * `group_members` — Mitgliedschafts-Junction (DATA_MODEL §5.2). Hierarchische Rolle
 * (owner/admin/moderator/member, genau **ein** Owner je Gruppe) + `status` (active/banned; Ban sperrt
 * alle Beitrittswege). `UNIQUE(group_id,user_id)` verhindert Doppel-Mitgliedschaft und sichert den
 * Beitritts-Race.
 */
class CreateGroupMembers extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'        => ['type' => 'bigint', 'unsigned' => true, 'auto_increment' => true],
            'group_id'  => ['type' => 'bigint', 'unsigned' => true],
            'user_id'   => ['type' => 'bigint', 'unsigned' => true],
            'role'      => ['type' => 'enum', 'constraint' => ['owner', 'admin', 'moderator', 'member'], 'default' => 'member'],
            'status'    => ['type' => 'enum', 'constraint' => ['active', 'banned'], 'default' => 'active'],
            'joined_at' => ['type' => 'timestamp', 'null' => true, 'default' => new RawSql('CURRENT_TIMESTAMP')],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['group_id', 'user_id']); // uq_group_user
        $this->forge->addKey(['user_id', 'group_id']);        // idx_gm_user ("meine Gruppen")

        $this->forge->addForeignKey('group_id', 'groups', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');

        $this->forge->createTable('group_members', true, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('group_members', true);
    }
}
