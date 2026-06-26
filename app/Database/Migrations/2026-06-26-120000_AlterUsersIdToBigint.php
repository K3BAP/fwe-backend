<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Hebt `users.id` (und alle abhängigen `user_id`-Spalten) von `INT UNSIGNED` auf `BIGINT UNSIGNED`
 * (ADR-012/A1: projektweit einheitlicher FK-Typ). Läuft **direkt nach** den Shield-Migrations und
 * **vor** `profiles` sowie allen Domänen-Tabellen, damit deren FKs typkompatibel sind.
 *
 * MySQL-spezifisch (ADR-002: MySQL ist das einzige Ziel): die FK-Constraints auf `users.id` werden
 * gelöst, die Spalten angehoben und die `ON DELETE CASCADE`-FKs neu gesetzt.
 */
class AlterUsersIdToBigint extends Migration
{
    /** Tabellen mit echtem FK auf `users.id` (CASCADE) — lösen & neu setzen. */
    private array $fkTables = ['auth_identities', 'auth_remember_tokens', 'auth_groups_users', 'auth_permissions_users'];

    /** Alle `user_id`-Spalten inkl. FK-loser Audit-Tabellen → Nullbarkeit je Tabelle. */
    private array $userIdColumns = [
        'auth_identities'        => 'NOT NULL',
        'auth_logins'            => 'NULL',
        'auth_token_logins'      => 'NULL',
        'auth_remember_tokens'   => 'NOT NULL',
        'auth_groups_users'      => 'NOT NULL',
        'auth_permissions_users' => 'NOT NULL',
    ];

    public function up(): void
    {
        if ($this->db->DBDriver !== 'MySQLi') {
            return;
        }
        $this->retype('BIGINT', 'INT(11)');
    }

    public function down(): void
    {
        if ($this->db->DBDriver !== 'MySQLi') {
            return;
        }
        $this->retype('INT(11)', 'BIGINT');
    }

    private function retype(string $newType, string $oldType): void
    {
        $db     = $this->db;
        $prefix = $db->DBPrefix;
        $users  = $prefix . 'users';

        // 1) Alle FKs lösen, die `users.id` referenzieren (Constraint-Namen variieren → aus dem Katalog lesen).
        foreach ($this->foreignKeysReferencingUsers() as $fk) {
            $db->query("ALTER TABLE `{$fk['TABLE_NAME']}` DROP FOREIGN KEY `{$fk['CONSTRAINT_NAME']}`");
        }

        // 2) PK und alle user_id-Spalten umtypisieren.
        $db->query("ALTER TABLE `{$users}` MODIFY `id` {$newType} UNSIGNED NOT NULL AUTO_INCREMENT");
        foreach ($this->userIdColumns as $table => $nullability) {
            $db->query("ALTER TABLE `{$prefix}{$table}` MODIFY `user_id` {$newType} UNSIGNED {$nullability}");
        }

        // 3) CASCADE-FKs wiederherstellen.
        foreach ($this->fkTables as $table) {
            $db->query(
                "ALTER TABLE `{$prefix}{$table}` ADD CONSTRAINT `{$prefix}{$table}_user_id_foreign`"
                . " FOREIGN KEY (`user_id`) REFERENCES `{$users}`(`id`) ON DELETE CASCADE"
            );
        }
    }

    /** @return list<array{TABLE_NAME:string,CONSTRAINT_NAME:string}> */
    private function foreignKeysReferencingUsers(): array
    {
        return $this->db->query(
            'SELECT TABLE_NAME, CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
             WHERE REFERENCED_TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME = ? AND REFERENCED_COLUMN_NAME = ?',
            [$this->db->getDatabase(), $this->db->DBPrefix . 'users', 'id']
        )->getResultArray();
    }
}
