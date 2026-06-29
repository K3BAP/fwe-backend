<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\ConversationModel;
use App\Models\FeedPostModel;
use App\Models\FeedPostReactionModel;
use App\Models\GroupInviteModel;
use App\Models\GroupJoinRequestModel;
use App\Models\GroupMemberModel;
use App\Models\GroupModel;
use App\Models\ProfileModel;
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
    /** Rollen-Rang für Hierarchie-/Moderationsprüfungen (höher = mehr Rechte). */
    private const RANK = ['owner' => 3, 'admin' => 2, 'moderator' => 1, 'member' => 0];

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

    // ──────────────────────────── Mitglieder-Verwaltung ────────────────────────────

    /**
     * Rolle eines Mitglieds ändern (§6.9). Hierarchie: nie gegen ranggleiche/-höhere Mitglieder; keine
     * Selbständerung; eine Rolle ≥ der eigenen vergeben ist verboten (⇒ nur Owner macht Admins);
     * Owner-Rolle nur per Transfer. Site-Admin umgeht die Rang-Schranken.
     *
     * @throws ApiException group_not_found | forbidden_role | not_found
     */
    public function setMemberRole(int $groupId, int $actorId, bool $isAdmin, int $targetUserId, string $newRole): void
    {
        $this->requireGroup($groupId);
        $target = $this->membershipOf($groupId, $targetUserId);
        if ($target === null) {
            throw new ApiException('not_found', 'Mitglied nicht gefunden.', 404);
        }
        if ($target['role'] === 'owner') {
            throw new ApiException('forbidden_role', 'Die Owner-Rolle kann nur per Transfer geändert werden.', 403);
        }

        if (! $isAdmin) {
            if ($targetUserId === $actorId) {
                throw new ApiException('forbidden_role', 'Du kannst deine eigene Rolle nicht ändern.', 403);
            }
            $actor = $this->membershipOf($groupId, $actorId);
            $actorRank = $actor !== null ? (self::RANK[$actor['role']] ?? 0) : -1;
            if ($actorRank < self::RANK['admin']) {
                throw new ApiException('forbidden_role', 'Dazu fehlt dir die Berechtigung.', 403);
            }
            if (self::RANK[$target['role']] >= $actorRank || self::RANK[$newRole] >= $actorRank) {
                throw new ApiException('forbidden_role', 'Du darfst diese Rolle nicht vergeben.', 403);
            }
        }

        model(GroupMemberModel::class)->where('group_id', $groupId)->where('user_id', $targetUserId)->set('role', $newRole)->update();
    }

    /**
     * Mitglied entfernen/kicken (§6.10). Ab `moderator`; nie gegen ranggleiche/-höhere; nicht den Owner.
     *
     * @throws ApiException group_not_found | forbidden_role | not_found
     */
    public function removeMember(int $groupId, int $actorId, bool $isAdmin, int $targetUserId): void
    {
        $this->requireGroup($groupId);
        $target = $this->membershipOf($groupId, $targetUserId);
        if ($target === null) {
            throw new ApiException('not_found', 'Mitglied nicht gefunden.', 404);
        }
        $this->assertCanModerate($groupId, $actorId, $isAdmin, $target);

        model(GroupMemberModel::class)->where('group_id', $groupId)->where('user_id', $targetUserId)->delete();
        $this->recountMembers($groupId);
    }

    /**
     * Ban umschalten (§6.9b). Ab `moderator`; nie gegen Owner/ranghöhere Mitglieder.
     *
     * @throws ApiException group_not_found | forbidden_role | not_found
     */
    public function toggleBan(int $groupId, int $actorId, bool $isAdmin, int $targetUserId): void
    {
        $this->requireGroup($groupId);
        $target = $this->membershipOf($groupId, $targetUserId);
        if ($target === null) {
            throw new ApiException('not_found', 'Mitglied nicht gefunden.', 404);
        }
        $this->assertCanModerate($groupId, $actorId, $isAdmin, $target);

        $newStatus = $target['status'] === 'banned' ? 'active' : 'banned';
        model(GroupMemberModel::class)->where('group_id', $groupId)->where('user_id', $targetUserId)->set('status', $newStatus)->update();
        $this->recountMembers($groupId);
    }

    /**
     * Eigentum übertragen (§6.9c). Nur Owner (oder Site-Admin): alter Owner → admin, Ziel → owner
     * (transaktional, genau ein Owner). Ziel muss aktives Mitglied sein.
     *
     * @throws ApiException group_not_found | forbidden_role | not_found
     */
    public function transferOwnership(int $groupId, int $actorId, bool $isAdmin, int $targetUserId): void
    {
        $group = $this->requireGroup($groupId);
        $this->assertOwner($groupId, $actorId, $isAdmin, 'Nur der Owner darf das Eigentum übertragen.');

        $currentOwnerId = (int) $group['owner_user_id'];
        if ($targetUserId === $currentOwnerId) {
            return; // bereits Owner
        }
        $target = $this->membershipOf($groupId, $targetUserId);
        if ($target === null || $target['status'] !== 'active') {
            throw new ApiException('not_found', 'Zielnutzer ist kein aktives Mitglied dieser Gruppe.', 404);
        }

        $members = model(GroupMemberModel::class);
        $db      = db_connect();
        $db->transBegin();
        try {
            $members->where('group_id', $groupId)->where('user_id', $currentOwnerId)->set('role', 'admin')->update();
            $members->where('group_id', $groupId)->where('user_id', $targetUserId)->set('role', 'owner')->update();
            model(GroupModel::class)->update($groupId, ['owner_user_id' => $targetUserId]);
            $db->transCommit();
        } catch (Throwable $e) {
            $db->transRollback();
            log_message('error', 'Group transfer failed: ' . $e->getMessage());
            throw new ApiException('internal_error', 'Übertragung fehlgeschlagen.', 500);
        }
    }

    // ──────────────────────────── Antrags-Entscheid ────────────────────────────

    /**
     * Beitrittsantrag genehmigen (§6.13). BOLA owner/admin. Legt das Mitglied transaktional an.
     *
     * @throws ApiException group_not_found | forbidden_role | not_found
     */
    public function approveRequest(int $groupId, int $actorId, bool $isAdmin, int $requestId): void
    {
        $this->requireGroup($groupId);
        $this->assertCanManage($groupId, $actorId, $isAdmin, 'Nur Owner/Admins dürfen Anträge entscheiden.');
        $request = $this->pendingRequest($groupId, $requestId);

        $db = db_connect();
        $db->transBegin();
        try {
            if ($this->membershipOf($groupId, (int) $request['user_id']) === null) {
                model(GroupMemberModel::class)->insert(['group_id' => $groupId, 'user_id' => $request['user_id'], 'role' => 'member', 'status' => 'active']);
            }
            model(GroupJoinRequestModel::class)->update((int) $request['id'], ['status' => 'approved', 'decided_by' => $actorId, 'decided_at' => gmdate('Y-m-d H:i:s')]);
            $this->recountMembers($groupId);
            $db->transCommit();
        } catch (Throwable $e) {
            $db->transRollback();
            log_message('error', 'Group approve failed: ' . $e->getMessage());
            throw new ApiException('internal_error', 'Genehmigung fehlgeschlagen.', 500);
        }
    }

    /**
     * Beitrittsantrag ablehnen (§6.13b). BOLA owner/admin.
     *
     * @throws ApiException group_not_found | forbidden_role | not_found
     */
    public function rejectRequest(int $groupId, int $actorId, bool $isAdmin, int $requestId): void
    {
        $this->requireGroup($groupId);
        $this->assertCanManage($groupId, $actorId, $isAdmin, 'Nur Owner/Admins dürfen Anträge entscheiden.');
        $request = $this->pendingRequest($groupId, $requestId);

        model(GroupJoinRequestModel::class)->update((int) $request['id'], ['status' => 'rejected', 'decided_by' => $actorId, 'decided_at' => gmdate('Y-m-d H:i:s')]);
    }

    // ──────────────────────────── Einladungen ────────────────────────────

    /**
     * Einladung erstellen (§6.14): gerichtet (`$invitedUserId`) oder teilbarer Token-Link.
     * BOLA owner/admin.
     *
     * @throws ApiException group_not_found | forbidden_role | validation_error
     */
    public function createInvite(int $groupId, int $actorId, bool $isAdmin, ?int $invitedUserId): void
    {
        $this->requireGroup($groupId);
        $this->assertCanManage($groupId, $actorId, $isAdmin, 'Nur Owner/Admins dürfen einladen.');

        $row = ['group_id' => $groupId, 'invited_by' => $actorId, 'status' => 'pending', 'uses_count' => 0];
        if ($invitedUserId !== null) {
            if (model(ProfileModel::class)->where('user_id', $invitedUserId)->countAllResults() === 0) {
                throw ApiException::validation(['user_id' => 'Nutzer nicht gefunden.']);
            }
            $row['invited_user_id'] = $invitedUserId;
        } else {
            $row['token'] = bin2hex(random_bytes(16));
        }

        model(GroupInviteModel::class)->insert($row);
    }

    /**
     * Einladung widerrufen (§6.16): `status=revoked`. BOLA owner/admin.
     *
     * @throws ApiException group_not_found | forbidden_role | not_found
     */
    public function revokeInvite(int $groupId, int $actorId, bool $isAdmin, int $inviteId): void
    {
        $this->requireGroup($groupId);
        $this->assertCanManage($groupId, $actorId, $isAdmin, 'Nur Owner/Admins dürfen Einladungen widerrufen.');

        $invite = model(GroupInviteModel::class)->where('id', $inviteId)->where('group_id', $groupId)->first();
        if ($invite === null) {
            throw new ApiException('not_found', 'Einladung nicht gefunden.', 404);
        }
        model(GroupInviteModel::class)->update($inviteId, ['status' => 'revoked']);
    }

    /**
     * Token-Einladung einlösen (§6.18). Idempotent gegen Doppelklick (zweiter Aufruf → already_member).
     * UI-Verdrahtung ist deferred; Endpunkt + Test erfüllen das Akzeptanzkriterium „Invite-Token tritt bei".
     *
     * @throws ApiException invite_not_found | invite_revoked | invite_expired | invite_exhausted | group_member_banned | already_member
     * @return int group_id
     */
    public function acceptInvite(string $token, int $userId): int
    {
        $invite = model(GroupInviteModel::class)->where('token', $token)->first();
        if ($invite === null) {
            throw new ApiException('invite_not_found', 'Einladung nicht gefunden.', 404);
        }
        $groupId = (int) $invite['group_id'];

        if ($invite['status'] === 'revoked') {
            throw ApiException::conflict('invite_revoked', 'Diese Einladung wurde widerrufen.');
        }
        if ($invite['expires_at'] !== null && (string) $invite['expires_at'] < gmdate('Y-m-d H:i:s')) {
            throw new ApiException('invite_expired', 'Dieser Einladungslink ist abgelaufen.', 410);
        }
        if ($invite['max_uses'] !== null && (int) $invite['uses_count'] >= (int) $invite['max_uses']) {
            throw ApiException::conflict('invite_exhausted', 'Dieser Einladungslink wurde bereits vollständig genutzt.');
        }

        $existing = $this->membershipOf($groupId, $userId);
        if ($existing !== null) {
            if ($existing['status'] === 'banned') {
                throw new ApiException('group_member_banned', 'Du wurdest aus dieser Gruppe ausgeschlossen.', 403);
            }
            throw ApiException::conflict('already_member', 'Du bist bereits Mitglied dieser Gruppe.');
        }

        $db = db_connect();
        $db->transBegin();
        try {
            model(GroupMemberModel::class)->insert(['group_id' => $groupId, 'user_id' => $userId, 'role' => 'member', 'status' => 'active']);
            $update = ['uses_count' => (int) $invite['uses_count'] + 1];
            if ($invite['invited_user_id'] !== null) {
                $update['status'] = 'accepted'; // gerichtete Invites sind einmalig
            }
            model(GroupInviteModel::class)->update((int) $invite['id'], $update);
            $this->recountMembers($groupId);
            $db->transCommit();
        } catch (Throwable $e) {
            $db->transRollback();
            log_message('error', 'Invite accept failed: ' . $e->getMessage());
            throw new ApiException('internal_error', 'Beitritt fehlgeschlagen.', 500);
        }

        return $groupId;
    }

    /**
     * Öffentliche Token-Vorschau (§6.17): Gruppe + Gültigkeit, ohne einzulösen.
     *
     * @return array{group: array<string, mixed>, valid: bool, expired: bool, uses_left: int|null}
     * @throws ApiException invite_not_found
     */
    public function invitePreview(string $token): array
    {
        $invite = model(GroupInviteModel::class)->where('token', $token)->first();
        if ($invite === null) {
            throw new ApiException('invite_not_found', 'Einladung nicht gefunden.', 404);
        }
        $group = $this->findRow((int) $invite['group_id']);
        if ($group === null) {
            throw new ApiException('invite_not_found', 'Einladung nicht gefunden.', 404);
        }

        $expired   = $invite['expires_at'] !== null && (string) $invite['expires_at'] < gmdate('Y-m-d H:i:s');
        $exhausted = $invite['max_uses'] !== null && (int) $invite['uses_count'] >= (int) $invite['max_uses'];
        $valid     = $invite['status'] === 'pending' && ! $expired && ! $exhausted;
        $usesLeft  = $invite['max_uses'] !== null ? max(0, (int) $invite['max_uses'] - (int) $invite['uses_count']) : null;

        return ['group' => $group, 'valid' => $valid, 'expired' => $expired, 'uses_left' => $usesLeft];
    }

    // ──────────────────────────── Channels ────────────────────────────

    /**
     * Channel anlegen (§7.2). BOLA owner/admin. `position` = max+1; neue Channels sind member-sichtbar.
     *
     * @throws ApiException group_not_found | forbidden_role
     */
    public function createChannel(int $groupId, int $actorId, bool $isAdmin, string $name): void
    {
        $this->requireGroup($groupId);
        $this->assertCanManage($groupId, $actorId, $isAdmin, 'Nur Owner/Admins dürfen Channels anlegen.');

        $max = (int) (db_connect()->table('conversations')
            ->selectMax('position')
            ->where('context_type', 'group')->where('context_id', $groupId)->where('type', 'group_channel')
            ->get()->getRowArray()['position'] ?? 0);

        model(ConversationModel::class)->insert([
            'type' => 'group_channel', 'context_type' => 'group', 'context_id' => $groupId,
            'title' => trim($name), 'position' => $max + 1, 'is_default' => 0, 'min_role' => 'member', 'created_by' => $actorId,
        ]);
    }

    /**
     * Channel umbenennen (§7.3). BOLA owner/admin.
     *
     * @throws ApiException group_not_found | forbidden_role | not_found
     */
    public function renameChannel(int $groupId, int $actorId, bool $isAdmin, int $conversationId, string $name): void
    {
        $this->requireGroup($groupId);
        $this->assertCanManage($groupId, $actorId, $isAdmin, 'Nur Owner/Admins dürfen Channels umbenennen.');
        $channel = $this->findChannel($groupId, $conversationId);
        if ($channel === null) {
            throw new ApiException('not_found', 'Channel nicht gefunden.', 404);
        }

        model(ConversationModel::class)->update($conversationId, ['title' => trim($name)]);
    }

    /**
     * Channel soft-löschen (§7.4). BOLA owner/admin. Default- und letzter Channel sind nicht löschbar.
     *
     * @throws ApiException group_not_found | forbidden_role | not_found | default_channel_not_deletable | last_channel_not_deletable
     */
    public function deleteChannel(int $groupId, int $actorId, bool $isAdmin, int $conversationId): void
    {
        $this->requireGroup($groupId);
        $this->assertCanManage($groupId, $actorId, $isAdmin, 'Nur Owner/Admins dürfen Channels löschen.');
        $channel = $this->findChannel($groupId, $conversationId);
        if ($channel === null) {
            throw new ApiException('not_found', 'Channel nicht gefunden.', 404);
        }
        if ((int) $channel['is_default'] === 1) {
            throw ApiException::conflict('default_channel_not_deletable', 'Der Standard-Channel kann nicht gelöscht werden.');
        }
        $active = db_connect()->table('conversations')
            ->where('context_type', 'group')->where('context_id', $groupId)->where('type', 'group_channel')->where('deleted_at', null)
            ->countAllResults();
        if ($active <= 1) {
            throw ApiException::conflict('last_channel_not_deletable', 'Der letzte Channel kann nicht gelöscht werden.');
        }

        model(ConversationModel::class)->update($conversationId, ['deleted_at' => gmdate('Y-m-d H:i:s')]);
    }

    // ──────────────────────────── Feed-Writes ────────────────────────────

    /**
     * Feed-Post anlegen (§8.2). BOLA owner/admin (`author_user_id` serverseitig).
     *
     * @param array<string, mixed> $input
     * @return int neue Post-ID
     * @throws ApiException group_not_found | forbidden_role
     */
    public function createFeedPost(int $groupId, int $authorId, bool $isAdmin, array $input): int
    {
        $this->requireGroup($groupId);
        $this->assertCanManage($groupId, $authorId, $isAdmin, 'Nur Owner/Admins dürfen im Feed posten.');

        return (int) model(FeedPostModel::class)->insert([
            'group_id'       => $groupId,
            'author_user_id' => $authorId,
            'title'          => $this->emptyToNull($input['title'] ?? null),
            'body'           => trim((string) ($input['body'] ?? '')),
            'is_pinned'      => 0,
        ], true);
    }

    /**
     * Feed-Post bearbeiten (§8.3). BOLA owner/admin.
     *
     * @param array<string, mixed> $input
     * @throws ApiException group_not_found | forbidden_role | not_found
     */
    public function updateFeedPost(int $groupId, int $actorId, bool $isAdmin, int $postId, array $input): void
    {
        $this->requireGroup($groupId);
        $this->assertCanManage($groupId, $actorId, $isAdmin, 'Nur Owner/Admins dürfen Beiträge bearbeiten.');
        $this->requireFeedPost($groupId, $postId);

        $data = [];
        if (array_key_exists('title', $input)) {
            $data['title'] = $this->emptyToNull($input['title']);
        }
        if (array_key_exists('body', $input) && trim((string) $input['body']) !== '') {
            $data['body'] = trim((string) $input['body']);
        }
        if ($data !== []) {
            model(FeedPostModel::class)->update($postId, $data);
        }
    }

    /**
     * Feed-Post soft-löschen (§8.4). Ab `moderator` (fremde Posts moderieren).
     *
     * @throws ApiException group_not_found | forbidden_role | not_found
     */
    public function deleteFeedPost(int $groupId, int $actorId, bool $isAdmin, int $postId): void
    {
        $this->requireGroup($groupId);
        $this->assertModeratorPlus($groupId, $actorId, $isAdmin, 'Dazu fehlt dir die Berechtigung.');
        $this->requireFeedPost($groupId, $postId);

        model(FeedPostModel::class)->update($postId, ['deleted_at' => gmdate('Y-m-d H:i:s'), 'deleted_by' => $actorId]);
    }

    /**
     * Pin umschalten (§8.6). BOLA owner/admin.
     *
     * @throws ApiException group_not_found | forbidden_role | not_found
     */
    public function togglePin(int $groupId, int $actorId, bool $isAdmin, int $postId): void
    {
        $this->requireGroup($groupId);
        $this->assertCanManage($groupId, $actorId, $isAdmin, 'Nur Owner/Admins dürfen anpinnen.');
        $post = $this->requireFeedPost($groupId, $postId);

        model(FeedPostModel::class)->update($postId, ['is_pinned' => (int) $post['is_pinned'] === 1 ? 0 : 1]);
    }

    /**
     * Emoji-Reaktion umschalten (§8.5). Eingeloggtes aktives Mitglied (oder Site-Admin).
     *
     * @throws ApiException group_not_found | forbidden_role | not_found
     */
    public function reactToPost(int $groupId, int $actorId, bool $isAdmin, int $postId, string $emoji): void
    {
        $this->requireGroup($groupId);
        $this->assertMember($groupId, $actorId, $isAdmin);
        $this->requireFeedPost($groupId, $postId);

        $emoji    = trim($emoji);
        $reactions = model(FeedPostReactionModel::class);
        $existing  = $reactions->where('feed_post_id', $postId)->where('user_id', $actorId)->where('emoji', $emoji)->first();
        if ($existing !== null) {
            $reactions->where('feed_post_id', $postId)->where('user_id', $actorId)->where('emoji', $emoji)->delete();

            return;
        }
        $reactions->insert(['feed_post_id' => $postId, 'user_id' => $actorId, 'emoji' => $emoji]);
    }

    /**
     * Einzelner Feed-Post (profiles-Join) oder `null` (für die Einzel-Antwort nach Create/Update/Pin/React).
     *
     * @return array<string, mixed>|null
     */
    public function findFeedPost(int $groupId, int $postId): ?array
    {
        return db_connect()->table('feed_posts fp')
            ->select('fp.id, fp.group_id, fp.title, fp.body, fp.image_path, fp.is_pinned, fp.created_at, fp.updated_at', false)
            ->select('p.user_id AS author_id, p.display_name AS author_display_name, p.handle AS author_handle, p.avatar_path AS author_avatar', false)
            ->join('profiles p', 'p.user_id = fp.author_user_id')
            ->where('fp.id', $postId)->where('fp.group_id', $groupId)->where('fp.deleted_at', null)
            ->get()->getRowArray();
    }

    // ──────────────────────────── Helfer ────────────────────────────

    /**
     * Moderations-Schranke: Akteur ist Site-Admin **oder** mind. `moderator` mit höherem Rang als das
     * Ziel. Nie gegen den Owner.
     *
     * @param array<string, mixed> $target
     * @throws ApiException forbidden_role
     */
    private function assertCanModerate(int $groupId, int $actorId, bool $isAdmin, array $target): void
    {
        if ($target['role'] === 'owner') {
            throw new ApiException('forbidden_role', 'Der Owner kann nicht moderiert werden.', 403);
        }
        if ($isAdmin) {
            return;
        }
        $actor     = $this->membershipOf($groupId, $actorId);
        $actorRank = $actor !== null ? (self::RANK[$actor['role']] ?? 0) : -1;
        if ($actorRank < self::RANK['moderator'] || $actorRank <= self::RANK[$target['role']]) {
            throw new ApiException('forbidden_role', 'Dazu fehlt dir die Berechtigung.', 403);
        }
    }

    /**
     * Mindestens `moderator` (oder Site-Admin) — für Feed-Moderation (fremde Posts löschen).
     *
     * @throws ApiException forbidden_role
     */
    private function assertModeratorPlus(int $groupId, int $actorId, bool $isAdmin, string $message): void
    {
        if ($isAdmin) {
            return;
        }
        $m = $this->membershipOf($groupId, $actorId);
        if ($m === null || (self::RANK[$m['role']] ?? 0) < self::RANK['moderator'] || $m['status'] !== 'active') {
            throw new ApiException('forbidden_role', $message, 403);
        }
    }

    /**
     * Aktives Mitglied (oder Site-Admin) — z.B. für Reaktionen.
     *
     * @throws ApiException forbidden_role
     */
    private function assertMember(int $groupId, int $actorId, bool $isAdmin): void
    {
        if ($isAdmin) {
            return;
        }
        $m = $this->membershipOf($groupId, $actorId);
        if ($m === null || $m['status'] !== 'active') {
            throw new ApiException('forbidden_role', 'Nur Mitglieder können reagieren.', 403);
        }
    }

    /**
     * Lädt einen nicht-gelöschten Gruppen-Channel oder `null`.
     *
     * @return array<string, mixed>|null
     */
    private function findChannel(int $groupId, int $conversationId): ?array
    {
        return db_connect()->table('conversations')
            ->where('id', $conversationId)->where('context_type', 'group')->where('context_id', $groupId)
            ->where('type', 'group_channel')->where('deleted_at', null)
            ->get()->getRowArray();
    }

    /**
     * Lädt einen nicht-gelöschten Feed-Post der Gruppe oder wirft `not_found`.
     *
     * @return array<string, mixed>
     * @throws ApiException not_found
     */
    private function requireFeedPost(int $groupId, int $postId): array
    {
        $post = model(FeedPostModel::class)->where('id', $postId)->where('group_id', $groupId)->where('deleted_at', null)->first();
        if ($post === null) {
            throw new ApiException('not_found', 'Beitrag nicht gefunden.', 404);
        }

        return $post;
    }

    /**
     * Lädt einen offenen (`pending`) Antrag der Gruppe oder wirft `not_found`.
     *
     * @return array<string, mixed>
     * @throws ApiException not_found
     */
    private function pendingRequest(int $groupId, int $requestId): array
    {
        $request = model(GroupJoinRequestModel::class)
            ->where('id', $requestId)->where('group_id', $groupId)->where('status', 'pending')->first();
        if ($request === null) {
            throw new ApiException('not_found', 'Antrag nicht gefunden.', 404);
        }

        return $request;
    }

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
