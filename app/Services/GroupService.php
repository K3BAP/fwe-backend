<?php

namespace App\Services;

use App\Models\GroupJoinRequestModel;
use App\Models\GroupMemberModel;
use CodeIgniter\Database\RawSql;

/**
 * Datenzugriff + Geschäftslogik der Gruppen-Domäne (ADR-013: Controller bleibt dünn). In M4-Slice 2
 * nur lesend (Verzeichnis/Detail/Mitglieder/Feed/Anträge/Invites/Channels). Schreiben (CRUD,
 * Mitgliedschaft, Verwaltung, Channels, Feed) folgt in Slice 3–5.
 *
 * `members_count` wird als **denormalisierte Spalte** geführt und in den Mitgliedschafts-Transaktionen
 * konsequent per {@see recountMembers()} aus der Wahrheit neu berechnet (driftfrei). Sichtbarkeit
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
}
