<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Zieht die in M3 bewusst ausgelassene FK `meetups.group_id` → `groups.id` nach (jetzt existiert die
 * `groups`-Tabelle). `ON DELETE SET NULL`: wird eine Gruppe gelöscht, verlieren etwaige gruppen-interne
 * Treffen nur ihre Verknüpfung, bleiben aber bestehen. Spalte + Index `idx_meetups_group` existieren
 * bereits aus M3 (CreateMeetups), hier kommt nur der Constraint dazu (ADR-012/B5 — Schema vorbereitet).
 */
class AlterMeetupsAddGroupForeignKey extends Migration
{
    public function up(): void
    {
        $this->forge->addForeignKey('group_id', 'groups', 'id', 'CASCADE', 'SET NULL');
        $this->forge->processIndexes('meetups');
    }

    public function down(): void
    {
        $this->forge->dropForeignKey('meetups', 'meetups_group_id_foreign');
    }
}
