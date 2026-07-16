<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;
use CodeIgniter\Database\RawSql;

/**
 * `conversation_participants` — Teilnehmer einer Konversation (DATA_MODEL §7.2). Trägt den
 * Ungelesen-Watermark (`last_read_message_id`/`last_read_at`) und `muted`. Bei DMs ist diese Tabelle
 * die maßgebliche Autorisierung; bei Channels/Treffen ist die Sichtbarkeit mitgliedschaftsgetrieben
 * (`group_members`/`meetup_participants`) und die Zeile wird (im Seed bzw. lazy beim Lesen) nur als
 * Watermark-Träger angelegt. `last_read_message_id`-FK → `messages` (jetzt vorhanden, daher inline).
 */
class CreateConversationParticipants extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'                   => ['type' => 'bigint', 'unsigned' => true, 'auto_increment' => true],
            'conversation_id'      => ['type' => 'bigint', 'unsigned' => true],
            'user_id'              => ['type' => 'bigint', 'unsigned' => true],
            'role'                 => ['type' => 'enum', 'constraint' => ['owner', 'admin', 'member'], 'default' => 'member'],
            'last_read_message_id' => ['type' => 'bigint', 'unsigned' => true, 'null' => true],
            'last_read_at'         => ['type' => 'timestamp', 'null' => true],
            'muted'                => ['type' => 'tinyint', 'constraint' => 1, 'default' => 0],
            'joined_at'            => ['type' => 'timestamp', 'null' => true, 'default' => new RawSql('CURRENT_TIMESTAMP')],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['conversation_id', 'user_id']); // uq_conv_user
        $this->forge->addKey(['user_id', 'conversation_id']);       // idx_cp_user (meine Konversationen)

        $this->forge->addForeignKey('conversation_id', 'conversations', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('last_read_message_id', 'messages', 'id', 'CASCADE', 'SET NULL');

        $this->forge->createTable('conversation_participants', true, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('conversation_participants', true);
    }
}
