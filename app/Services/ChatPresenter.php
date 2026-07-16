<?php

namespace App\Services;

/**
 * Baut die Chat-DTOs (API.md §9–10) aus Tabellenzeilen. **Eine** Stelle für die Projektionen, von
 * Read- und Write-Controllern genutzt. Feldnamen entsprechen exakt dem Wire-Vertrag (Zod-Schemas im
 * Frontend: `conversationListItemSchema`, `conversationDetailSchema`, `messageSchema`,
 * `replyPreviewSchema`, `reactionSchema`). `sender`/`peer` sind `PublicUserCard`.
 */
final class ChatPresenter
{
    /**
     * Sidebar-Projektion einer Konversation.
     *
     * @param array<string, mixed>      $row        conversation-Zeile (+ vorberechneter `title`)
     * @param array<string, mixed>|null $lastMsgRow letzte Nachricht (`body`,`deleted_at`,`sender_name`,`created_at`) oder null
     * @param array<string, mixed>|null $peerCard   DM-Gegenüber (PublicUserCard) oder null
     * @return array<string, mixed>
     */
    public function listItem(array $row, ?array $lastMsgRow, int $unread, ?array $peerCard): array
    {
        $lastMessage = $lastMsgRow === null ? null : [
            'body'        => $lastMsgRow['deleted_at'] !== null ? null : $lastMsgRow['body'],
            'sender_name' => $lastMsgRow['sender_name'],
            'created_at'  => (string) $this->toIso($lastMsgRow['created_at']),
        ];

        return [
            'id'              => (int) $row['id'],
            'type'            => $row['type'],
            'title'           => (string) $row['title'],
            'peer'            => $peerCard,
            'last_message'    => $lastMessage,
            'unread_count'    => $unread,
            'last_message_at' => $this->toIso($row['last_message_at'] ?? null),
        ];
    }

    /**
     * Detail-Projektion: Metadaten + Teilnehmer.
     *
     * @param array<string, mixed>            $row              conversation-Zeile (+ `title`)
     * @param array<string, mixed>|null       $peerCard         DM-Gegenüber oder null
     * @param list<array<string, mixed>>      $participantCards PublicUserCard[]
     * @return array<string, mixed>
     */
    public function detail(array $row, ?array $peerCard, array $participantCards, ?int $creatorUserId): array
    {
        return [
            'id'              => (int) $row['id'],
            'type'            => $row['type'],
            'title'           => (string) $row['title'],
            'peer'            => $peerCard,
            'participants'    => $participantCards,
            'creator_user_id' => $creatorUserId,
        ];
    }

    /**
     * Nachricht mit aggregierten Reaktionen und (optionaler) Reply-Vorschau.
     *
     * @param array<string, mixed>                            $row          message + sender_* (profiles-Join)
     * @param list<array{emoji:string,count:int,me:bool}>     $reactions
     * @param array{id:int,sender_name:string,body:?string}|null $replyPreview
     * @return array<string, mixed>
     */
    public function message(array $row, array $reactions, ?array $replyPreview, bool $isCreator): array
    {
        $deleted = ($row['deleted_at'] ?? null) !== null;

        return [
            'id'              => (int) $row['id'],
            'conversation_id' => (int) $row['conversation_id'],
            'sender'          => $this->userCard((int) $row['sender_id'], $row['sender_display_name'], $row['sender_handle'], $row['sender_avatar'] ?? null),
            'body'            => $deleted ? null : $row['body'],
            'reply_to'        => $replyPreview,
            'is_creator'      => $isCreator,
            'created_at'      => (string) $this->toIso($row['created_at']),
            'edited_at'       => $this->toIso($row['edited_at'] ?? null),
            'deleted_at'      => $this->toIso($row['deleted_at'] ?? null),
            'reactions'       => $reactions,
        ];
    }

    /**
     * Reply-Vorschau (zitierte Nachricht) — `body` null, falls das Ziel selbst gelöscht ist.
     *
     * @param array<string, mixed> $row reply-target message (+ sender_name)
     * @return array{id:int,sender_name:string,body:?string}
     */
    public function replyPreview(array $row): array
    {
        return [
            'id'          => (int) $row['id'],
            'sender_name' => $row['sender_name'],
            'body'        => ($row['deleted_at'] ?? null) !== null ? null : $row['body'],
        ];
    }

    /**
     * Reduzierte Nutzer-Kurzform (PublicUserCard) — identisch zu {@see ProfilePresenter::publicUserCard}.
     *
     * @return array<string, mixed>
     */
    public function userCard(int $id, mixed $displayName, mixed $handle, mixed $avatarPath): array
    {
        return [
            'id'           => $id,
            'display_name' => $displayName,
            'handle'       => $handle,
            'avatar_path'  => $avatarPath,
        ];
    }

    /** MySQL-DATETIME(.fff) → ISO-8601 (UTC; appTimezone = UTC). Schneidet ms ab (Sekunden genügen dem FE). */
    private function toIso(?string $datetime): ?string
    {
        if ($datetime === null) {
            return null;
        }
        $datetime = explode('.', $datetime)[0]; // TIMESTAMP(3): „2026-06-29 12:00:00.123" → ohne ms

        return str_replace(' ', 'T', $datetime) . 'Z';
    }
}
