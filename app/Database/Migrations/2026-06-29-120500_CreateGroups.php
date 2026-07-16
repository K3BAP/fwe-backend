<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;
use CodeIgniter\Database\RawSql;

/**
 * `groups` — Gruppen (DATA_MODEL §5.1). Zwei orthogonale Achsen (ADR-006): `visibility`
 * (public/private/unlisted) × `join_policy` (open/request/invite_only). `slug` ist der eindeutige
 * URL-Identifier; `name` ist **nicht** eindeutig (gleiche Namen je Region erlaubt). `members_count` ist
 * denormalisiert (in den Mitgliedschafts-Transaktionen gepflegt). Owner-FK = **RESTRICT** (ADR-012/C4:
 * verhindert verwaiste Gruppen — Eigentum muss vor Nutzer-Löschung übertragen werden). **Soft-Delete**.
 */
class CreateGroups extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'            => ['type' => 'bigint', 'unsigned' => true, 'auto_increment' => true],
            'slug'          => ['type' => 'varchar', 'constraint' => 120],
            'name'          => ['type' => 'varchar', 'constraint' => 120],
            'description'   => ['type' => 'text', 'null' => true],
            'logo_path'     => ['type' => 'varchar', 'constraint' => 255, 'null' => true],
            'region'        => ['type' => 'varchar', 'constraint' => 80, 'null' => true],
            'tags'          => ['type' => 'json', 'null' => true],
            'rules_text'    => ['type' => 'text', 'null' => true],
            'visibility'    => ['type' => 'enum', 'constraint' => ['public', 'private', 'unlisted'], 'default' => 'public'],
            'join_policy'   => ['type' => 'enum', 'constraint' => ['open', 'request', 'invite_only'], 'default' => 'open'],
            'owner_user_id' => ['type' => 'bigint', 'unsigned' => true],
            'members_count' => ['type' => 'int', 'unsigned' => true, 'default' => 0],
            'created_at'    => ['type' => 'timestamp', 'null' => true, 'default' => new RawSql('CURRENT_TIMESTAMP')],
            'updated_at'    => ['type' => 'timestamp', 'null' => true, 'default' => new RawSql('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')],
            'deleted_at'    => ['type' => 'timestamp', 'null' => true],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey('slug');     // uq_groups_slug
        $this->forge->addKey('region');         // idx_groups_region
        $this->forge->addKey('visibility');     // idx_groups_visibility

        $this->forge->addForeignKey('owner_user_id', 'users', 'id', 'RESTRICT', 'CASCADE');

        $this->forge->createTable('groups', true, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('groups', true);
    }
}
