<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;
use CodeIgniter\Database\RawSql;

/**
 * `group_invites` — Einladungen bei `join_policy='invite_only'` (DATA_MODEL §5.6). Zwei Modi: gerichtet
 * (`invited_user_id` gesetzt, `token` NULL) **oder** teilbarer Link (`token` gesetzt, `invited_user_id`
 * NULL). `expired` wird im Read aus `expires_at` abgeleitet (kein Cron, ADR-002); `uses_count`/`max_uses`
 * steuern Mehrfachnutzung von Link-Invites.
 */
class CreateGroupInvites extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'              => ['type' => 'bigint', 'unsigned' => true, 'auto_increment' => true],
            'group_id'        => ['type' => 'bigint', 'unsigned' => true],
            'invited_by'      => ['type' => 'bigint', 'unsigned' => true],
            'invited_user_id' => ['type' => 'bigint', 'unsigned' => true, 'null' => true],
            'token'           => ['type' => 'varchar', 'constraint' => 64, 'null' => true],
            'status'          => ['type' => 'enum', 'constraint' => ['pending', 'accepted', 'declined', 'revoked', 'expired'], 'default' => 'pending'],
            'expires_at'      => ['type' => 'datetime', 'null' => true],
            'max_uses'        => ['type' => 'int', 'unsigned' => true, 'null' => true],
            'uses_count'      => ['type' => 'int', 'unsigned' => true, 'default' => 0],
            'created_at'      => ['type' => 'timestamp', 'null' => true, 'default' => new RawSql('CURRENT_TIMESTAMP')],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey('token');     // uq_invite_token
        $this->forge->addKey('group_id');        // idx_inv_group
        $this->forge->addKey('invited_user_id'); // idx_inv_user

        $this->forge->addForeignKey('group_id', 'groups', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('invited_by', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('invited_user_id', 'users', 'id', 'CASCADE', 'CASCADE');

        $this->forge->createTable('group_invites', true, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('group_invites', true);
    }
}
