<?php

namespace App\Services;

/**
 * Baut die Gruppen-DTOs (API.md §6–8) aus Tabellenzeilen. **Eine** Stelle für die Projektionen,
 * von Read-, Write- und Verwaltungs-Controllern genutzt. Feldnamen entsprechen exakt dem Wire-Vertrag
 * (Zod-Schemas im Frontend: `groupListItemSchema`, `groupDetailSchema`, `groupMemberSchema`,
 * `feedPostSchema`, `joinRequestSchema`, `groupInviteSchema`, `groupChannelSchema`).
 */
final class GroupPresenter
{
    /**
     * Listen-/Karten-Projektion (Verzeichnis, Dashboard).
     *
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function listItem(array $row): array
    {
        return [
            'id'            => (int) $row['id'],
            'slug'          => $row['slug'],
            'name'          => $row['name'],
            'description'   => $row['description'],
            'logo_path'     => $row['logo_path'] ?? null,
            'region'        => $row['region'],
            'tags'          => $this->decodeTags($row['tags'] ?? null),
            'visibility'    => $row['visibility'],
            'join_policy'   => $row['join_policy'],
            'members_count' => (int) $row['members_count'],
        ];
    }

    /**
     * Detail-Projektion: Listenfelder + Regeln, Owner, eigene Mitgliedschaft und Verwaltungsrecht.
     *
     * @param array<string, mixed>      $row
     * @param array<string, mixed>|null $membership eigene group_members-Zeile (role/status) oder null
     * @return array<string, mixed>
     */
    public function detail(array $row, ?array $membership, bool $isSiteAdmin, bool $hasPendingRequest): array
    {
        $myMembership = $membership !== null
            ? ['role' => $membership['role'], 'status' => $membership['status']]
            : null;
        $canManage = $isSiteAdmin
            || ($membership !== null && in_array($membership['role'], ['owner', 'admin'], true));

        return array_merge($this->listItem($row), [
            'rules_text'          => $row['rules_text'],
            'owner_user_id'       => (int) $row['owner_user_id'],
            'my_membership'       => $myMembership,
            'can_manage'          => $canManage,
            'has_pending_request' => $hasPendingRequest,
        ]);
    }

    /**
     * Mitglieder-Zeile (profiles-Join + role/status/joined_at).
     *
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function member(array $row): array
    {
        return [
            'user'      => $this->userCard((int) $row['user_id'], $row['display_name'], $row['handle'], $row['avatar_path'] ?? null),
            'role'      => $row['role'],
            'status'    => $row['status'],
            'joined_at' => (string) $this->toIso($row['joined_at']),
        ];
    }

    /**
     * Feed-Post mit aggregierten Reaktionen.
     *
     * @param array<string, mixed>            $row       fp.* + author_* (profiles-Join)
     * @param list<array{emoji:string,count:int,me:bool}> $reactions
     * @return array<string, mixed>
     */
    public function feedPost(array $row, array $reactions): array
    {
        return [
            'id'         => (int) $row['id'],
            'group_id'   => (int) $row['group_id'],
            'author'     => $this->userCard((int) $row['author_id'], $row['author_display_name'], $row['author_handle'], $row['author_avatar'] ?? null),
            'title'      => $row['title'],
            'body'       => $row['body'],
            'image_path' => $row['image_path'] ?? null,
            'is_pinned'  => (bool) $row['is_pinned'],
            'created_at' => (string) $this->toIso($row['created_at']),
            // `updated_at` nur, wenn tatsächlich bearbeitet (≠ created_at) — das FE rendert sonst
            // fälschlich „· bearbeitet" für jeden Post (Spalte hat ON UPDATE CURRENT_TIMESTAMP).
            'updated_at' => (isset($row['updated_at']) && $row['updated_at'] !== null && $row['updated_at'] !== $row['created_at'])
                ? $this->toIso($row['updated_at'])
                : null,
            'reactions'  => $reactions,
        ];
    }

    /**
     * Beitrittsantrag (profiles-Join des Antragstellers).
     *
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function joinRequest(array $row): array
    {
        return [
            'id'         => (int) $row['id'],
            'user'       => $this->userCard((int) $row['user_id'], $row['display_name'], $row['handle'], $row['avatar_path'] ?? null),
            'message'    => $row['message'],
            'status'     => $row['status'],
            'created_at' => (string) $this->toIso($row['created_at']),
        ];
    }

    /**
     * Einladung. `expired` wird im Read aus `expires_at` abgeleitet (kein Cron, ADR-002).
     *
     * @param array<string, mixed> $row fp invite-Zeile (+ optional invited_* profiles-Join)
     * @return array<string, mixed>
     */
    public function invite(array $row): array
    {
        $invitedUser = null;
        if ($row['invited_user_id'] !== null && isset($row['display_name'])) {
            $invitedUser = $this->userCard((int) $row['invited_user_id'], $row['display_name'], $row['handle'], $row['avatar_path'] ?? null);
        }

        $status = $row['status'];
        if ($status === 'pending' && $row['expires_at'] !== null && (string) $row['expires_at'] < gmdate('Y-m-d H:i:s')) {
            $status = 'expired';
        }

        return [
            'id'           => (int) $row['id'],
            'invited_user' => $invitedUser,
            'token'        => $row['token'],
            'status'       => $status,
            'max_uses'     => $row['max_uses'] !== null ? (int) $row['max_uses'] : null,
            'uses_count'   => (int) $row['uses_count'],
        ];
    }

    /**
     * Gruppen-Channel (= conversation type=group_channel). `unread_count` ist in M4 stets 0 (Messages M5).
     *
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function channel(array $row): array
    {
        return [
            'conversation_id' => (int) $row['id'],
            'name'            => $row['title'],
            'is_default'      => (bool) $row['is_default'],
            'unread_count'    => 0,
        ];
    }

    /**
     * Reduzierte Nutzer-Kurzform (PublicUserCard) — identisch zu {@see ProfilePresenter::publicUserCard}.
     *
     * @return array<string, mixed>
     */
    private function userCard(int $id, mixed $displayName, mixed $handle, mixed $avatarPath): array
    {
        return [
            'id'           => $id,
            'display_name' => $displayName,
            'handle'       => $handle,
            'avatar_path'  => $avatarPath,
        ];
    }

    /** JSON-`tags` → string[]|null (defensiv: nur Arrays werden durchgereicht). */
    private function decodeTags(mixed $tags): ?array
    {
        if ($tags === null || $tags === '') {
            return null;
        }
        $decoded = is_array($tags) ? $tags : json_decode((string) $tags, true);

        return is_array($decoded) ? array_values(array_map('strval', $decoded)) : null;
    }

    /** MySQL-DATETIME → ISO-8601 (UTC; appTimezone = UTC). */
    private function toIso(?string $datetime): ?string
    {
        return $datetime === null ? null : str_replace(' ', 'T', $datetime) . 'Z';
    }
}
