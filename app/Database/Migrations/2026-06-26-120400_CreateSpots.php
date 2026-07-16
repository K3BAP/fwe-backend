<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;
use CodeIgniter\Database\RawSql;

/**
 * `spots` — kuratierte Startplätze (DATA_MODEL §4.1, ADR-007). Read-only für Nutzer; gepflegt nur per
 * Seed/Admin (kein `POST /spots`, ADR-012/A4). Quelle für Leaflet-Marker und den Treffen-Wizard;
 * `region` ist die denormalisierte Quelle für `meetups.region`.
 */
class CreateSpots extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'          => ['type' => 'bigint', 'unsigned' => true, 'auto_increment' => true],
            'name'        => ['type' => 'varchar', 'constraint' => 150],
            'region'      => ['type' => 'varchar', 'constraint' => 80],
            'country'     => ['type' => 'char', 'constraint' => 2, 'default' => 'DE'],
            'lat'         => ['type' => 'decimal', 'constraint' => '9,6'],
            'lng'         => ['type' => 'decimal', 'constraint' => '9,6'],
            'type'        => ['type' => 'enum', 'constraint' => ['launch', 'landing', 'area'], 'default' => 'launch'],
            'description' => ['type' => 'text', 'null' => true],
            'created_at'  => ['type' => 'timestamp', 'null' => true, 'default' => new RawSql('CURRENT_TIMESTAMP')],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('region');       // idx_spots_region
        $this->forge->addKey(['lat', 'lng']); // idx_spots_geo

        $this->forge->createTable('spots', true, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('spots', true);
    }
}
