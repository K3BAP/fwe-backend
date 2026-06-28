<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;
use CodeIgniter\Database\RawSql;

/**
 * `meetups` — Flugtreffen (DATA_MODEL §4.2). Persistiert wird nur `status ∈ {open, cancelled}`;
 * `full`/`finished` werden im Read berechnet (kein Cron, ADR-002). Geo (`spot_name/region/lat/lng`)
 * wird beim Erstellen aus dem Spot kopiert (Snapshot). **Hard-Delete** (kein `deleted_at`); Teilnehmer
 * verschwinden via FK-Cascade. `visibility`/`group_id` sind vorbereitetes, in M3 ungenutztes Schema
 * (ADR-012/B5) — die `group_id`-FK wird erst in M4 (mit der `groups`-Tabelle) nachgezogen.
 */
class CreateMeetups extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'               => ['type' => 'bigint', 'unsigned' => true, 'auto_increment' => true],
            'creator_user_id'  => ['type' => 'bigint', 'unsigned' => true],
            'spot_id'          => ['type' => 'bigint', 'unsigned' => true, 'null' => true],
            'spot_name'        => ['type' => 'varchar', 'constraint' => 150, 'null' => true],
            'region'           => ['type' => 'varchar', 'constraint' => 80, 'null' => true],
            'lat'              => ['type' => 'decimal', 'constraint' => '9,6', 'null' => true],
            'lng'              => ['type' => 'decimal', 'constraint' => '9,6', 'null' => true],
            'title'            => ['type' => 'varchar', 'constraint' => 150],
            'description'      => ['type' => 'text', 'null' => true],
            'starts_at'        => ['type' => 'datetime'],
            'experience_level' => ['type' => 'enum', 'constraint' => ['beginner', 'advanced', 'expert', 'all'], 'default' => 'all'],
            'max_participants' => ['type' => 'smallint', 'unsigned' => true, 'null' => true], // NULL = unbegrenzt
            'status'           => ['type' => 'enum', 'constraint' => ['open', 'cancelled'], 'default' => 'open'],
            'visibility'       => ['type' => 'enum', 'constraint' => ['public', 'group'], 'default' => 'public'],
            'group_id'         => ['type' => 'bigint', 'unsigned' => true, 'null' => true],
            'created_at'       => ['type' => 'timestamp', 'null' => true, 'default' => new RawSql('CURRENT_TIMESTAMP')],
            'updated_at'       => ['type' => 'timestamp', 'null' => true, 'default' => new RawSql('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('starts_at');             // idx_meetups_starts
        $this->forge->addKey('region');                // idx_meetups_region
        $this->forge->addKey('experience_level');      // idx_meetups_level
        $this->forge->addKey('status');                // idx_meetups_status
        $this->forge->addKey('spot_id');
        $this->forge->addKey('creator_user_id');
        $this->forge->addKey('group_id');              // idx_meetups_group (vorbereitet)
        $this->forge->addKey(['status', 'starts_at']); // idx_meetups_filter (Listenansicht)

        $this->forge->addForeignKey('creator_user_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('spot_id', 'spots', 'id', 'CASCADE', 'SET NULL');
        // group_id-FK bewusst NICHT hier (groups-Tabelle existiert erst ab M4 → ALTER in M4).

        $this->forge->createTable('meetups', true, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('meetups', true);
    }
}
