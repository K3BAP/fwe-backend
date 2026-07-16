<?php

namespace App\Services\Admin;

use App\Exceptions\ApiException;
use App\Models\ProfileModel;
use CodeIgniter\Database\BaseBuilder;
use CodeIgniter\Shield\Models\UserModel;

/**
 * Benutzer-Verwaltung des Admin-Bereichs (ADR-019). Die einzige Domäne, die eigene Schreib-Endpunkte
 * braucht — Treffen und Gruppen nutzt der Admin über den vorhandenen `$isAdmin`-BOLA-Override der
 * jeweiligen Services.
 *
 * **Löschen ist ausschließlich Shields Soft-Delete** (`users.deleted_at`) und damit umkehrbar. Ein
 * Hard-Delete ist bewusst nicht angeboten: `groups.owner_user_id` ist `ON DELETE RESTRICT`, ein
 * gelöschter Gruppen-Eigentümer würde also am FK scheitern.
 *
 * **Selbstschutz:** Der Handelnde kann sich nicht selbst degradieren, sperren oder löschen. Da der
 * `admin`-Filter garantiert, dass der Handelnde Admin ist, folgt daraus die Invariante: es gibt immer
 * mindestens einen Admin. Eine separate „letzter Admin"-Prüfung erübrigt sich damit.
 */
final class UserAdminService
{
    /** @var array<string, string> sort-Param → "spalte richtung" */
    private const SORTS = [
        'created_at_desc'  => 'u.created_at DESC',
        'created_at_asc'   => 'u.created_at ASC',
        'name_asc'         => 'p.display_name ASC',
        'email_asc'        => 'email ASC',
        'last_active_desc' => 'u.last_active DESC',
    ];

    private const MEETUPS_SUBQUERY = '(SELECT COUNT(*) FROM meetups m WHERE m.creator_user_id = u.id)';
    private const GROUPS_SUBQUERY  = "(SELECT COUNT(*) FROM group_members gm WHERE gm.user_id = u.id AND gm.status = 'active')";

    /**
     * Gefilterte/sortierte/paginierte Nutzerliste.
     *
     * @param array<string, mixed> $f q, status(active|suspended|deleted|admins), sort, limit, offset
     * @return array{items: list<array<string, mixed>>, total: int, limit: int, offset: int, sort: string}
     */
    public function list(array $f): array
    {
        $limit  = max(1, min(200, (int) ($f['limit'] ?? 20)));
        $offset = max(0, (int) ($f['offset'] ?? 0));
        $sort   = isset($f['sort'], self::SORTS[$f['sort']]) ? (string) $f['sort'] : 'created_at_desc';

        $data = $this->baseQuery()
            ->select('u.id, u.active, u.created_at, u.last_active, u.deleted_at', false)
            ->select('ai.secret AS email', false)
            ->select('p.display_name, p.handle, p.avatar_path, p.experience_level', false)
            ->select(self::MEETUPS_SUBQUERY . ' AS meetups_count', false)
            ->select(self::GROUPS_SUBQUERY . ' AS groups_count', false)
            ->select('(agu.user_id IS NOT NULL) AS is_admin', false);
        $this->applyFilters($data, $f);
        $items = $data->orderBy(self::SORTS[$sort], '', false)->orderBy('u.id', 'ASC')
            ->limit($limit, $offset)->get()->getResultArray();

        $countB = $this->baseQuery()->select('COUNT(*) AS total', false);
        $this->applyFilters($countB, $f);
        $total = (int) ($countB->get()->getRowArray()['total'] ?? 0);

        return ['items' => $items, 'total' => $total, 'limit' => $limit, 'offset' => $offset, 'sort' => $sort];
    }

    /**
     * Einzelner Nutzer inkl. Profilfeldern — **auch soft-gelöschte** (die soll der Admin ja sehen).
     *
     * @return array<string, mixed>|null
     */
    public function findRow(int $id): ?array
    {
        return $this->baseQuery()
            ->select('u.id, u.active, u.created_at, u.last_active, u.deleted_at', false)
            ->select('ai.secret AS email', false)
            ->select('p.display_name, p.handle, p.avatar_path, p.experience_level', false)
            ->select('p.bio_markdown, p.license_class, p.glider, p.home_region, p.flight_hours', false)
            ->select(self::MEETUPS_SUBQUERY . ' AS meetups_count', false)
            ->select(self::GROUPS_SUBQUERY . ' AS groups_count', false)
            ->select('(agu.user_id IS NOT NULL) AS is_admin', false)
            ->where('u.id', $id)
            ->get()->getRowArray();
    }

    /**
     * Profil eines beliebigen Nutzers ändern — die Admin-Variante von `ProfileController::updateMe`,
     * inklusive derselben Handle-Eindeutigkeit.
     *
     * `email` bleibt bewusst außen vor: sie liegt in `auth_identities`, und sie zu ändern hieße
     * Identity neu speichern + Verifikation + Eindeutigkeit — E-Mail-Flows sind laut ADR-008 out of scope.
     *
     * @param array<string, mixed> $input
     * @throws ApiException not_found | handle_taken
     */
    public function updateProfile(int $userId, array $input): void
    {
        $this->assertExists($userId);

        $profiles = model(ProfileModel::class);
        $handle   = $this->emptyToNull($input['handle'] ?? null);

        if ($handle !== null && $profiles->where('handle', $handle)->where('user_id !=', $userId)->first() !== null) {
            throw ApiException::conflict('handle_taken', 'Dieser Handle ist bereits vergeben.');
        }

        $data = [
            'bio_markdown'     => $this->emptyToNull($input['bio_markdown'] ?? null),
            'experience_level' => $this->emptyToNull($input['experience_level'] ?? null),
            'license_class'    => $this->emptyToNull($input['license_class'] ?? null),
            'glider'           => $this->emptyToNull($input['glider'] ?? null),
            'home_region'      => $this->emptyToNull($input['home_region'] ?? null),
            'flight_hours'     => $this->emptyToNull($input['flight_hours'] ?? null) === null ? null : (int) $input['flight_hours'],
        ];
        // display_name und handle sind NOT NULL — nur überschreiben, wenn mitgeschickt, nie leeren.
        if (($input['display_name'] ?? '') !== '') {
            $data['display_name'] = $input['display_name'];
        }
        if ($handle !== null) {
            $data['handle'] = $handle;
        }

        $profiles->update($userId, $data);
    }

    /**
     * Plattform-Admin-Rechte vergeben/entziehen (Shield-Group `admin`).
     *
     * @throws ApiException not_found | admin_self_demote
     */
    public function setAdmin(int $userId, int $actorId, bool $isAdmin): void
    {
        if (! $isAdmin && $userId === $actorId) {
            throw ApiException::conflict('admin_self_demote', 'Du kannst dir die Admin-Rechte nicht selbst entziehen.');
        }
        $this->assertExists($userId);

        // Über die Shield-Entity, damit `auth_groups_users` konsistent bleibt. Soft-gelöschte Nutzer
        // findet der Provider nicht mehr — die Rolle ist dort ohnehin bedeutungslos.
        $user = model(UserModel::class)->findById($userId);
        if ($user === null) {
            return;
        }

        $isAdmin ? $user->addGroup('admin') : $user->removeGroup('admin');
    }

    /**
     * Konto sperren/entsperren. Die Sperre greift sofort — der ApiAuthFilter prüft `active` pro Request.
     *
     * @throws ApiException not_found | admin_self_deactivate
     */
    public function setActive(int $userId, int $actorId, bool $active): void
    {
        if (! $active && $userId === $actorId) {
            throw ApiException::conflict('admin_self_deactivate', 'Du kannst dich nicht selbst deaktivieren.');
        }
        $this->assertExists($userId);

        model(UserModel::class)->update($userId, ['active' => $active]);
    }

    /**
     * Soft-Delete: der Nutzer kann sich nicht mehr anmelden und verliert eine laufende Session, seine
     * Inhalte (Treffen, Gruppen, Nachrichten) bleiben aber bestehen — es ist ein UPDATE, kein DELETE,
     * also greift keine FK-Kaskade. Das ist gewollt und wird im UI auch so benannt.
     *
     * @throws ApiException not_found | admin_self_delete
     */
    public function softDelete(int $userId, int $actorId): void
    {
        if ($userId === $actorId) {
            throw ApiException::conflict('admin_self_delete', 'Du kannst dein eigenes Konto nicht löschen.');
        }
        $this->assertExists($userId);

        model(UserModel::class)->delete($userId); // $useSoftDeletes = true → setzt deleted_at
    }

    /** @throws ApiException not_found */
    public function restore(int $userId): void
    {
        $this->assertExists($userId);

        // `deleted_at` steht **nicht** in Shields $allowedFields (UserModel: username, status,
        // status_message, active, last_active) → `$users->update()` würde das Feld stillschweigend
        // verwerfen und nichts täte sich. Deshalb bewusst direkt über den Query-Builder.
        db_connect()->table('users')->where('id', $userId)->update(['deleted_at' => null]);
    }

    /**
     * Gemeinsame Joins für Liste und Detail.
     *
     * Bewusst auf der **rohen** `users`-Tabelle statt über Shields UserModel: dessen Soft-Delete-Scope
     * würde genau die Zeilen ausblenden, die der Admin sehen muss, und seine `afterFind`-Callbacks
     * würden pro Seite drei Zusatzabfragen auslösen.
     *
     * Der `agu`-Join löst die Admin-Rolle **im selben Scan** auf — `inGroup()` je Zeile wäre N+1
     * (Shields bündelnder `afterFind` greift hier nicht, weil wir das Model umgehen). `profiles` wird
     * per LEFT gejoint: eine Ansicht, die „alle Nutzer" zeigen soll, darf keinen Nutzer verschlucken,
     * nur weil ihm die Profilzeile fehlt.
     */
    private function baseQuery(): BaseBuilder
    {
        return db_connect()->table('users u')
            ->join('auth_identities ai', "ai.user_id = u.id AND ai.type = 'email_password'", 'left')
            ->join('profiles p', 'p.user_id = u.id', 'left')
            // `group` ist ein reserviertes MySQL-Wort → Backticks sind hier Pflicht.
            ->join('auth_groups_users agu', "agu.user_id = u.id AND agu.`group` = 'admin'", 'left');
    }

    /**
     * Filter für Daten- **und** Count-Builder — identisch angewandt, damit `meta.total` exakt zur Liste passt.
     *
     * @param array<string, mixed> $f
     */
    private function applyFilters(BaseBuilder $b, array $f): void
    {
        if (! empty($f['q'])) {
            $q = (string) $f['q'];
            $b->groupStart()
                ->like('p.display_name', $q)
                ->orLike('p.handle', $q)
                ->orLike('ai.secret', $q)
                ->groupEnd();
        }

        // Ohne `status` **kein** Filter: die Admin-Liste zeigt standardmäßig die Wahrheit, inkl. gelöschter Konten.
        switch ($f['status'] ?? null) {
            case 'active':
                $b->where('u.deleted_at IS NULL', null, false)->where('u.active', 1);
                break;

            case 'suspended':
                $b->where('u.deleted_at IS NULL', null, false)->where('u.active', 0);
                break;

            case 'deleted':
                $b->where('u.deleted_at IS NOT NULL', null, false);
                break;

            case 'admins':
                $b->where('agu.user_id IS NOT NULL', null, false);
                break;
        }
    }

    /** @throws ApiException not_found */
    private function assertExists(int $userId): void
    {
        if ($this->findRow($userId) === null) {
            throw ApiException::notFound('Benutzer nicht gefunden.');
        }
    }

    private function emptyToNull(mixed $value): mixed
    {
        return ($value === '' || $value === null) ? null : $value;
    }
}
