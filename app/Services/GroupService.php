<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\ConversationModel;
use App\Models\GroupJoinRequestModel;
use App\Models\GroupMemberModel;
use App\Models\GroupModel;
use CodeIgniter\Database\RawSql;
use Throwable;

/**
 * Datenzugriff + Geschäftslogik der Gruppen-Domäne (ADR-013: Controller bleibt dünn). Lesen
 * (Verzeichnis/Detail/Mitglieder/Feed/Anträge/Invites/Channels), CRUD und Mitgliedschaft
 * (join/leave/request/withdraw). Verwaltung/Channels/Feed-Writes folgen in Slice 4–5.
 *
 * `members_count` wird als **denormalisierte Spalte** geführt und nach jeder Mitgliedschaftsänderung
 * per {@see recountMembers()} aus der Wahrheit neu berechnet (driftfrei). Sichtbarkeit
 * (public/unlisted/private) wird zentral im Listen-Filter durchgesetzt.
 */
final class GroupService
{
    // ───────────────────────────── Lesen ─────────────────────────────

    /**
     * Sichtbares Verzeichnis (unpaginiert, ADR-006): Gast sieht nur `public`; eingeloggt zusätzlich
     * Gruppen mit eigener **aktiver** Mitgliedschaft (eigene private/unlisted). Soft-deleted raus.
     *
     * @return list<array<string, mixed>>
     */
    public function list(int $viewerId): array
    {
        $b = db_connect()->table('groups g')->select('g.*', false)->where('g.deleted_at', null);

        if ($viewerId > 0) {
            $b->groupStart()
                ->where('g.visibility', 'public')
                ->orWhere(new RawSql("g.id IN (SELECT gm.group_id FROM group_members gm WHERE gm.user_id = {$viewerId} AND gm.status = 'active')"))
                ->groupEnd();
        } else {
            $b->where('g.visibility', 'public');
        }

        return $b->orderBy('g.name', 'ASC')->get()->getResultArray();
    }

    /**
     * Einzelne Gruppe (ohne soft-deleted) oder `null`.
     *
     * @return array<string, mixed>|null
     */
    public function findRow(int $id): ?array
    {
        return db_connect()->table('groups g')
            ->select('g.*', false)
            ->where('g.id', $id)
            ->where('g.deleted_at', null)
            ->get()->getRowArray();
    }

    /**
     * Eigene Mitgliedschaftszeile (role/status) oder `null` (Gast/Nicht-Mitglied).
     *
     * @return array<string, mixed>|null
     */
    public function membershipOf(int $groupId, int $userId): ?array
    {
        if ($userId <= 0) {
            return null;
        }

        return model(GroupMemberModel::class)
            ->where('group_id', $groupId)->where('user_id', $userId)->first();
    }

    /** Hat der Nutzer einen offenen (`pending`) Beitrittsantrag für die Gruppe? */
    public function hasPendingRequest(int $groupId, int $userId): bool
    {
        if ($userId <= 0) {
            return false;
        }

        return model(GroupJoinRequestModel::class)
            ->where('group_id', $groupId)->where('user_id', $userId)->where('status', 'pending')
            ->countAllResults() > 0;
    }

    /**
     * Mitglieder (profiles-Join), sortiert nach Rollen-Rang dann Beitrittsdatum. Inklusive `banned`
     * (Verwaltungs-UI zeigt sie zum Entbannen).
     *
     * @return list<array<string, mixed>>
     */
    public function members(int $groupId): array
    {
        return db_connect()->table('group_members gm')
            ->select('p.user_id, p.display_name, p.handle, p.avatar_path, gm.role, gm.status, gm.joined_at', false)
            ->join('profiles p', 'p.user_id = gm.user_id')
            ->where('gm.group_id', $groupId)
            ->orderBy("FIELD(gm.role,'owner','admin','moderator','member')", '', false)
            ->orderBy('gm.joined_at', 'ASC')
            ->get()->getResultArray();
    }

    /**
     * Feed-Posts (profiles-Join des Autors), pinned-first dann neueste zuerst, ohne soft-deleted.
     *
     * @return list<array<string, mixed>>
     */
    public function feedPosts(int $groupId): array
    {
        return db_connect()->table('feed_posts fp')
            ->select('fp.id, fp.group_id, fp.title, fp.body, fp.image_path, fp.is_pinned, fp.created_at, fp.updated_at', false)
            ->select('p.user_id AS author_id, p.display_name AS author_display_name, p.handle AS author_handle, p.avatar_path AS author_avatar', false)
            ->join('profiles p', 'p.user_id = fp.author_user_id')
            ->where('fp.group_id', $groupId)
            ->where('fp.deleted_at', null)
            ->orderBy('fp.is_pinned', 'DESC')
            ->orderBy('fp.created_at', 'DESC')
            ->orderBy('fp.id', 'DESC')
            ->get()->getResultArray();
    }

    /**
     * Aggregierte Reaktionen je Post (`{emoji, count, me}`), `me` bezogen auf den Betrachter.
     *
     * @param list<int> $postIds
     * @return array<int, list<array{emoji:string,count:int,me:bool}>>
     */
    public function reactionsFor(array $postIds, int $viewerId): array
    {
        if ($postIds === []) {
            return [];
        }

        $rows = db_connect()->table('feed_post_reactions')
            ->select("feed_post_id, emoji, COUNT(*) AS cnt, MAX(CASE WHEN user_id = {$viewerId} THEN 1 ELSE 0 END) AS me", false)
            ->whereIn('feed_post_id', $postIds)
            ->groupBy(['feed_post_id', 'emoji'])
            ->orderBy('cnt', 'DESC')
            ->orderBy('emoji', 'ASC')
            ->get()->getResultArray();

        $map = [];
        foreach ($rows as $r) {
            $map[(int) $r['feed_post_id']][] = [
                'emoji' => $r['emoji'],
                'count' => (int) $r['cnt'],
                'me'    => (bool) $r['me'],
            ];
        }

        return $map;
    }

    /**
     * Offene Beitrittsanträge (profiles-Join), älteste zuerst.
     *
     * @return list<array<string, mixed>>
     */
    public function joinRequests(int $groupId): array
    {
        return db_connect()->table('group_join_requests jr')
            ->select('jr.id, jr.message, jr.status, jr.created_at, p.user_id, p.display_name, p.handle, p.avatar_path', false)
            ->join('profiles p', 'p.user_id = jr.user_id')
            ->where('jr.group_id', $groupId)
            ->where('jr.status', 'pending')
            ->orderBy('jr.created_at', 'ASC')
            ->get()->getResultArray();
    }

    /**
     * Einladungen der Gruppe (Token + gerichtet; bei gerichteten der profiles-Join), neueste zuerst.
     *
     * @return list<array<string, mixed>>
     */
    public function invites(int $groupId): array
    {
        return db_connect()->table('group_invites gi')
            ->select('gi.id, gi.invited_user_id, gi.token, gi.status, gi.expires_at, gi.max_uses, gi.uses_count', false)
            ->select('p.display_name, p.handle, p.avatar_path', false)
            ->join('profiles p', 'p.user_id = gi.invited_user_id', 'left')
            ->where('gi.group_id', $groupId)
            ->orderBy('gi.created_at', 'DESC')
            ->get()->getResultArray();
    }

    /**
     * Channels der Gruppe (= conversations type=group_channel), nach `position`. `min_role='admin'`-
     * Channels nur für owner/admin/site-admin sichtbar (moderator/member nicht, ADR-012/B4).
     *
     * @param array<string, mixed>|null $membership
     * @return list<array<string, mixed>>
     */
    public function channels(int $groupId, ?array $membership, bool $isSiteAdmin): array
    {
        $b = db_connect()->table('conversations')
            ->where('type', 'group_channel')
            ->where('context_type', 'group')
            ->where('context_id', $groupId)
            ->where('deleted_at', null);

        $canSeeAdmin = $isSiteAdmin || ($membership !== null && in_array($membership['role'], ['owner', 'admin'], true));
        if (! $canSeeAdmin) {
            $b->where('min_role', 'member');
        }

        return $b->orderBy('position', 'ASC')->orderBy('id', 'ASC')->get()->getResultArray();
    }

    // ──────────────────────────── Gruppen-CRUD ────────────────────────────

    /**
     * Gründet eine Gruppe (§6.3) in einer Transaktion: eindeutigen Slug erzeugen, Gruppe anlegen,
     * Ersteller als `owner`-Mitglied, Default-Channel „Allgemein". Server ignoriert ein client-seitiges
     * `slug` (wird immer aus `name` generiert).
     *
     * @param array<string, mixed> $input
     * @throws ApiException internal_error
     */
    public function create(int $ownerId, array $input): int
    {
        $db = db_connect();
        $db->transBegin();
        try {
            $id = (int) model(GroupModel::class)->insert([
                'slug'          => $this->generateSlug((string) ($input['name'] ?? '')),
                'name'          => trim((string) $input['name']),
                'description'   => $this->emptyToNull($input['description'] ?? null),
                'region'        => $this->emptyToNull($input['region'] ?? null),
                'tags'          => $this->encodeTags($input['tags'] ?? null),
                'rules_text'    => $this->emptyToNull($input['rules_text'] ?? null),
                'visibility'    => $input['visibility'],
                'join_policy'   => $input['join_policy'],
                'owner_user_id' => $ownerId,
                'members_count' => 1,
            ], true);

            model(GroupMemberModel::class)->insert(['group_id' => $id, 'user_id' => $ownerId, 'role' => 'owner', 'status' => 'active']);
            $this->createDefaultChannel($id, $ownerId);

            $db->transCommit();

            return $id;
        } catch (Throwable $e) {
            $db->transRollback();
            if ($e instanceof ApiException) {
                throw $e;
            }
            log_message('error', 'Group create failed: ' . $e->getMessage());
            throw new ApiException('internal_error', 'Gruppe konnte nicht erstellt werden.', 500);
        }
    }

    /**
     * Metadaten bearbeiten (§6.5). BOLA: owner/admin oder Site-Admin. `slug` bleibt unverändert; nur
     * vorhandene Felder werden geschrieben.
     *
     * @param array<string, mixed> $input
     * @throws ApiException group_not_found | forbidden_role
     */
    public function update(int $id, int $userId, bool $isAdmin, array $input): void
    {
        $this->requireGroup($id);
        $this->assertCanManage($id, $userId, $isAdmin, 'Nur Owner/Admins dürfen die Gruppe bearbeiten.');

        $data = [];
        if (array_key_exists('name', $input)) {
            $data['name'] = trim((string) $input['name']);
        }
        if (array_key_exists('description', $input)) {
            $data['description'] = $this->emptyToNull($input['description']);
        }
        if (array_key_exists('region', $input)) {
            $data['region'] = $this->emptyToNull($input['region']);
        }
        if (array_key_exists('tags', $input)) {
            $data['tags'] = $this->encodeTags($input['tags']);
        }
        if (array_key_exists('rules_text', $input)) {
            $data['rules_text'] = $this->emptyToNull($input['rules_text']);
        }
        if (in_array($input['visibility'] ?? null, ['public', 'private', 'unlisted'], true)) {
            $data['visibility'] = $input['visibility'];
        }
        if (in_array($input['join_policy'] ?? null, ['open', 'request', 'invite_only'], true)) {
            $data['join_policy'] = $input['join_policy'];
        }

        if ($data !== []) {
            model(GroupModel::class)->update($id, $data);
        }
    }

    /**
     * Gruppe soft-löschen (§6.6). Nur Owner (oder Site-Admin). Channels werden via
     * `conversations.deleted_at` mit-archiviert; Mitglieder/Anträge etc. bleiben (Read filtert über
     * die Gruppe).
     *
     * @throws ApiException group_not_found | forbidden_role
     */
    public function delete(int $id, int $userId, bool $isAdmin): void
    {
        $this->requireGroup($id);
        $this->assertOwner($id, $userId, $isAdmin, 'Nur der Owner darf die Gruppe löschen.');

        $now = gmdate('Y-m-d H:i:s');
        $db  = db_connect();
        $db->transBegin();
        try {
            model(GroupModel::class)->update($id, ['deleted_at' => $now]);
            $db->table('conversations')
                ->where('context_type', 'group')->where('context_id', $id)->where('deleted_at', null)
                ->update(['deleted_at' => $now]);
            $db->transCommit();
        } catch (Throwable $e) {
            $db->transRollback();
            log_message('error', 'Group delete failed: ' . $e->getMessage());
            throw new ApiException('internal_error', 'Gruppe konnte nicht gelöscht werden.', 500);
        }
    }

    // ──────────────────────────── Mitgliedschaft ────────────────────────────

    /**
     * Direkter Beitritt (§6.8) — nur bei `join_policy='open'`. Ban-Check vor allem; idempotent gegen
     * Doppelklick (`uq_group_user`).
     *
     * @throws ApiException group_not_found | group_member_banned | join_policy_mismatch | already_member
     */
    public function join(int $id, int $userId): void
    {
        $group = $this->requireGroup($id);
        $existing = $this->membershipOf($id, $userId);
        if ($existing !== null) {
            if ($existing['status'] === 'banned') {
                throw new ApiException('group_member_banned', 'Du wurdest aus dieser Gruppe ausgeschlossen.', 403);
            }
            throw ApiException::conflict('already_member', 'Du bist bereits Mitglied dieser Gruppe.');
        }
        if ($group['join_policy'] !== 'open') {
            throw ApiException::conflict('join_policy_mismatch', 'Diese Gruppe erfordert eine Anfrage oder Einladung.');
        }

        try {
            model(GroupMemberModel::class)->insert(['group_id' => $id, 'user_id' => $userId, 'role' => 'member', 'status' => 'active']);
        } catch (Throwable $e) {
            // UNIQUE-Race (zeitgleicher Beitritt): existiert die Zeile nun ⇒ idempotent, sonst Fehler.
            if ($this->membershipOf($id, $userId) === null) {
                throw $e;
            }
        }
        $this->recountMembers($id);
    }

    /**
     * Selbst-Austritt (§6.8b). Owner muss zuerst übertragen. Idempotent (kein Mitglied ⇒ no-op).
     *
     * @throws ApiException group_not_found | owner_must_transfer
     */
    public function leave(int $id, int $userId): void
    {
        $this->requireGroup($id);
        $membership = $this->membershipOf($id, $userId);
        if ($membership === null) {
            return;
        }
        if ($membership['role'] === 'owner') {
            throw ApiException::conflict('owner_must_transfer', 'Übertrage erst das Eigentum, bevor du die Gruppe verlässt.');
        }

        model(GroupMemberModel::class)->where('group_id', $id)->where('user_id', $userId)->delete();
        $this->recountMembers($id);
    }

    /**
     * Beitrittsantrag stellen (§6.11) — nur bei `join_policy='request'`. Offener `pending`-Antrag wird
     * wiederverwendet (kein Duplikat).
     *
     * @throws ApiException group_not_found | group_member_banned | already_member | join_policy_mismatch
     */
    public function requestJoin(int $id, int $userId, ?string $message): void
    {
        $group    = $this->requireGroup($id);
        $existing = $this->membershipOf($id, $userId);
        if ($existing !== null) {
            if ($existing['status'] === 'banned') {
                throw new ApiException('group_member_banned', 'Du wurdest aus dieser Gruppe ausgeschlossen.', 403);
            }
            throw ApiException::conflict('already_member', 'Du bist bereits Mitglied dieser Gruppe.');
        }
        if ($group['join_policy'] !== 'request') {
            throw ApiException::conflict('join_policy_mismatch', 'Diese Gruppe nimmt keine Beitrittsanträge entgegen.');
        }

        $requests = model(GroupJoinRequestModel::class);
        if ($requests->where('group_id', $id)->where('user_id', $userId)->where('status', 'pending')->countAllResults() > 0) {
            return; // bereits offen → idempotent
        }
        $requests->insert([
            'group_id' => $id,
            'user_id'  => $userId,
            'message'  => $this->emptyToNull($message),
            'status'   => 'pending',
        ]);
    }

    /**
     * Eigenen offenen Antrag zurückziehen (§6.11b): `pending` → `cancelled`. Idempotent.
     *
     * @throws ApiException group_not_found
     */
    public function withdrawRequest(int $id, int $userId): void
    {
        $this->requireGroup($id);
        model(GroupJoinRequestModel::class)
            ->where('group_id', $id)->where('user_id', $userId)->where('status', 'pending')
            ->set('status', 'cancelled')->update();
    }

    // ──────────────────────────── Helfer ────────────────────────────

    /**
     * Lädt die Gruppe oder wirft `group_not_found`.
     *
     * @return array<string, mixed>
     * @throws ApiException group_not_found
     */
    private function requireGroup(int $id): array
    {
        $row = $this->findRow($id);
        if ($row === null) {
            throw new ApiException('group_not_found', 'Gruppe nicht gefunden.', 404);
        }

        return $row;
    }

    /**
     * Verwaltungsrecht (owner/admin der Gruppe oder Site-Admin), sonst `403 forbidden_role`.
     *
     * @throws ApiException forbidden_role
     */
    private function assertCanManage(int $groupId, int $userId, bool $isAdmin, string $message): void
    {
        if ($isAdmin) {
            return;
        }
        $m = $this->membershipOf($groupId, $userId);
        if ($m === null || ! in_array($m['role'], ['owner', 'admin'], true)) {
            throw new ApiException('forbidden_role', $message, 403);
        }
    }

    /**
     * Owner-Recht (oder Site-Admin), sonst `403 forbidden_role`.
     *
     * @throws ApiException forbidden_role
     */
    private function assertOwner(int $groupId, int $userId, bool $isAdmin, string $message): void
    {
        if ($isAdmin) {
            return;
        }
        $m = $this->membershipOf($groupId, $userId);
        if ($m === null || $m['role'] !== 'owner') {
            throw new ApiException('forbidden_role', $message, 403);
        }
    }

    /** Default-Channel „Allgemein" einer frisch gegründeten Gruppe. */
    private function createDefaultChannel(int $groupId, int $ownerId): void
    {
        model(ConversationModel::class)->insert([
            'type' => 'group_channel', 'context_type' => 'group', 'context_id' => $groupId,
            'title' => 'Allgemein', 'position' => 0, 'is_default' => 1, 'min_role' => 'member', 'created_by' => $ownerId,
        ]);
    }

    /** `members_count` aus der Wahrheit neu berechnen (aktive Mitglieder). */
    private function recountMembers(int $groupId): void
    {
        db_connect()->query(
            'UPDATE `groups` SET members_count = (SELECT COUNT(*) FROM group_members WHERE group_id = ? AND status = "active") WHERE id = ?',
            [$groupId, $groupId],
        );
    }

    /** Eindeutigen Slug aus dem Namen erzeugen (Umlaute → ASCII, bei Kollision Suffix `-n`). */
    private function generateSlug(string $name): string
    {
        $base = $this->slugify($name);
        if ($base === '') {
            $base = 'gruppe';
        }
        $slug  = $base;
        $n     = 2;
        $model = model(GroupModel::class);
        while ($model->where('slug', $slug)->countAllResults() > 0) {
            $slug = $base . '-' . $n++;
        }

        return $slug;
    }

    private function slugify(string $name): string
    {
        $s = strtr($name, ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss', 'Ä' => 'ae', 'Ö' => 'oe', 'Ü' => 'ue']);
        $s = preg_replace('/[^a-z0-9]+/', '-', strtolower($s)) ?? '';

        return trim($s, '-');
    }

    private function encodeTags(mixed $tags): ?string
    {
        if (! is_array($tags) || $tags === []) {
            return null;
        }

        return json_encode(array_values(array_map('strval', $tags)), JSON_UNESCAPED_UNICODE) ?: null;
    }

    private function emptyToNull(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }
}
