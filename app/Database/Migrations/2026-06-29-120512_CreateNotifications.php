<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;
use CodeIgniter\Database\RawSql;

/**
 * `notifications` — In-App-Benachrichtigungen (DATA_MODEL §8.1, ADR-008). `type` ist `VARCHAR`
 * (erweiterbar, ADR-012/C8); der `text`/`link` für die UI wird **serverseitig im Presenter** aus
 * `type` + `actor` + `data`(JSON) erzeugt. `context_type`/`context_id` sind polymorph (kein harter FK).
 * `read_at = NULL` ⇒ ungelesen. Index `(user_id, read_at, id)` bedient Liste + unread-count.
 */
class CreateNotifications extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'            => ['type' => 'bigint', 'unsigned' => true, 'auto_increment' => true],
            'user_id'       => ['type' => 'bigint', 'unsigned' => true],
            'type'          => ['type' => 'varchar', 'constraint' => 50],
            'actor_user_id' => ['type' => 'bigint', 'unsigned' => true, 'null' => true],
            'context_type'  => ['type' => 'enum', 'constraint' => ['meetup', 'group', 'conversation', 'message', 'join_request'], 'null' => true],
            'context_id'    => ['type' => 'bigint', 'unsigned' => true, 'null' => true],
            'data'          => ['type' => 'json', 'null' => true],
            'read_at'       => ['type' => 'timestamp', 'null' => true],
            'created_at'    => ['type' => 'timestamp', 'null' => true, 'default' => new RawSql('CURRENT_TIMESTAMP')],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addKey(['user_id', 'read_at', 'id']); // idx_notif_user (Liste + unread-count)

        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('actor_user_id', 'users', 'id', 'CASCADE', 'SET NULL');

        $this->forge->createTable('notifications', true, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('notifications', true);
    }
}
