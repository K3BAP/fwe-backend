<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Zieht die in M3 ausgelassene `meetups.conversation_id` nach (jetzt existiert die `conversations`-
 * Tabelle inkl. Chat-Engine, ADR-005). Jedes Treffen bekommt genau einen Treffen-Chat; die Spalte
 * verweist darauf. `ON DELETE SET NULL`: wird die Konversation entfernt, verliert das Treffen nur die
 * Verknüpfung. (Die `conversations`-Seite garantiert via generiertes `meetup_uniq` einen Chat je Treffen.)
 */
class AlterMeetupsAddConversation extends Migration
{
    public function up(): void
    {
        $this->forge->addColumn('meetups', [
            'conversation_id' => ['type' => 'bigint', 'unsigned' => true, 'null' => true, 'after' => 'group_id'],
        ]);

        $this->forge->addForeignKey('conversation_id', 'conversations', 'id', 'CASCADE', 'SET NULL');
        $this->forge->processIndexes('meetups');
    }

    public function down(): void
    {
        $this->forge->dropForeignKey('meetups', 'meetups_conversation_id_foreign');
        $this->forge->dropColumn('meetups', 'conversation_id');
    }
}
