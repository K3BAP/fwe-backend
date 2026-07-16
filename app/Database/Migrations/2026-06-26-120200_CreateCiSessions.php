<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;
use CodeIgniter\Database\RawSql;

/**
 * `ci_sessions` — Tabelle für den Session-`DatabaseHandler` (06-backend §9; Config\Session::$savePath).
 * Schema gemäß CI4-Userguide (matchIP = false → PK auf `id`).
 */
class CreateCiSessions extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'         => ['type' => 'varchar', 'constraint' => 128, 'null' => false],
            'ip_address' => ['type' => 'varchar', 'constraint' => 45, 'null' => false],
            'timestamp'  => ['type' => 'timestamp', 'null' => false, 'default' => new RawSql('CURRENT_TIMESTAMP')],
            'data'       => ['type' => 'blob', 'null' => false],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('timestamp');

        $this->forge->createTable('ci_sessions', true, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('ci_sessions', true);
    }
}
