<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;
use CodeIgniter\Database\RawSql;

/**
 * `profiles` — 1:1 zu Shield-`users` (DATA_MODEL §3, ADR-010/012). Hält die Pilot-Stammdaten
 * (Anzeigename, Bio, Avatar) plus die optionalen „Erweitert"-Felder. PK **ist** der FK auf `users.id`
 * (`ON DELETE CASCADE` → Profil verschwindet mit dem Konto). `email_verified_at` ist für ADR-008
 * vorbereitet, aber in M2 ungenutzt.
 */
class CreateProfiles extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'user_id'           => ['type' => 'bigint', 'unsigned' => true],
            'display_name'      => ['type' => 'varchar', 'constraint' => 80],
            'handle'            => ['type' => 'varchar', 'constraint' => 40, 'null' => true],
            'bio_markdown'      => ['type' => 'text', 'null' => true],
            'avatar_path'       => ['type' => 'varchar', 'constraint' => 255, 'null' => true],
            'experience_level'  => ['type' => 'enum', 'constraint' => ['beginner', 'advanced', 'expert'], 'null' => true],
            'license_class'     => ['type' => 'varchar', 'constraint' => 60, 'null' => true],
            'glider'            => ['type' => 'varchar', 'constraint' => 120, 'null' => true],
            'home_region'       => ['type' => 'varchar', 'constraint' => 80, 'null' => true],
            'flight_hours'      => ['type' => 'int', 'unsigned' => true, 'null' => true],
            'email_verified_at' => ['type' => 'timestamp', 'null' => true],
            'created_at'        => ['type' => 'timestamp', 'null' => true, 'default' => new RawSql('CURRENT_TIMESTAMP')],
            'updated_at'        => ['type' => 'timestamp', 'null' => true, 'default' => new RawSql('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')],
        ]);

        $this->forge->addPrimaryKey('user_id');
        $this->forge->addUniqueKey('handle');
        $this->forge->addKey('experience_level'); // idx_profiles_experience (Suche/Matching)
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');

        $this->forge->createTable('profiles', true, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('profiles', true);
    }
}
