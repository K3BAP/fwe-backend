<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;
use CodeIgniter\Database\RawSql;

/**
 * `meetup_participants` — Teilnahme-Junction (DATA_MODEL §4.3). Bewusst schlank (ADR-015): **kein**
 * `role` (Organisator = `meetups.creator_user_id`), **kein** `status`/`waitlist` (Teilnahme = Zeile
 * existiert). `UNIQUE(meetup_id,user_id)` verhindert Doppelanmeldung und sichert den Beitritts-Race.
 */
class CreateMeetupParticipants extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'        => ['type' => 'bigint', 'unsigned' => true, 'auto_increment' => true],
            'meetup_id' => ['type' => 'bigint', 'unsigned' => true],
            'user_id'   => ['type' => 'bigint', 'unsigned' => true],
            'joined_at' => ['type' => 'timestamp', 'null' => true, 'default' => new RawSql('CURRENT_TIMESTAMP')],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['meetup_id', 'user_id']); // uq_meetup_user
        $this->forge->addKey('user_id');                       // idx_mp_user ("meine Treffen")

        $this->forge->addForeignKey('meetup_id', 'meetups', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');

        $this->forge->createTable('meetup_participants', true, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('meetup_participants', true);
    }
}
