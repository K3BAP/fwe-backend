<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\ConversationModel;
use App\Models\ConversationParticipantModel;
use App\Models\MessageModel;
use App\Models\MessageReactionModel;
use Throwable;

/**
 * Geschäftslogik der Chat-Engine (API.md §9–10, ADR-005). **Lesen** (Slice 2): Sidebar-Liste, Detail,
 * Verlauf, Ungelesen-Zähler. **Schreiben** (Slice 3): Senden/Edit(15min)/Delete(Tombstone)/Reaktion-
 * Toggle/markRead/DM find-or-create. Zugriff ist **mitgliedschaftsgetrieben** (BOLA, ADR-004): DM über
 * `conversation_participants`, `group_channel` über aktives `group_members` (+ `min_role`), `meetup`
 * über `meetup_participants`. `conversation_participants` trägt bei Channels/Treffen nur den
 * Ungelesen-Watermark.
 */
final class ChatService
{
    /** Server-Allowlist für Reaktionen (= Palette der Frontend-`ReactionBar`). */
    private const ALLOWED_EMOJIS = ['👍', '🔥', '🪂', '❤️', '😂', '🥾'];

    // ──────────────────────────── Zugriff (BOLA) ────────────────────────────

    /**
     * Lädt eine nicht-gelöschte Konversation oder wirft `not_found`.
     *
     * @return array<string, mixed>
     * @throws ApiException not_found
     */
    public function requireConversation(int $id): array
    {
        $row = db_connect()->table('conversations')->where('id', $id)->where('deleted_at', null)->get()->getRowArray();
        if ($row === null) {
            throw new ApiException('not_found', 'Konversation nicht gefunden.', 404);
        }

        return $row;
    }

    /**
     * Stellt sicher, dass der Betrachter Teilnehmer ist, und liefert die Konversationszeile.
     *
     * @return array<string, mixed>
     * @throws ApiException not_found | not_a_participant
     */
    public function assertAccess(int $convId, int $viewerId): array
    {
        $conv = $this->requireConversation($convId);
        if (! $this->canAccess($conv, $viewerId)) {
            throw new ApiException('not_a_participant', 'Du bist kein Teilnehmer dieser Konversation.', 403);
        }

        return $conv;
    }

    /** @param array<string, mixed> $conv */
    public function canAccess(array $conv, int $viewerId): bool
    {
        if ($viewerId <= 0) {
            return false;
        }

        return match ($conv['type']) {
            'direct'        => $this->isDmParticipant((int) $conv['id'], $viewerId),
            'meetup'        => $this->isMeetupParticipant((int) $conv['context_id'], $viewerId),
            'group_channel' => $this->canAccessChannel($conv, $viewerId),
            default         => false,
        };
    }

    private function isDmParticipant(int $convId, int $viewerId): bool
    {
        return db_connect()->table('conversation_participants')
            ->where('conversation_id', $convId)->where('user_id', $viewerId)->countAllResults() > 0;
    }

    private function isMeetupParticipant(int $meetupId, int $viewerId): bool
    {
        return db_connect()->table('meetup_participants')
            ->where('meetup_id', $meetupId)->where('user_id', $viewerId)->countAllResults() > 0;
    }

    /** @param array<string, mixed> $conv */
    private function canAccessChannel(array $conv, int $viewerId): bool
    {
        $gm = db_connect()->table('group_members')
            ->select('role')
            ->where('group_id', $conv['context_id'])->where('user_id', $viewerId)->where('status', 'active')
            ->get()->getRowArray();
        if ($gm === null) {
            return false;
        }
        // min_role='admin'-Channels nur für owner/admin (moderator/member nicht, ADR-012/B4).
        return $conv['min_role'] !== 'admin' || in_array($gm['role'], ['owner', 'admin'], true);
    }

    // ──────────────────────────── Liste / Zähler ────────────────────────────

    /**
     * Sidebar-Liste: je Konversation Roh-Zeile (inkl. `title`/Peer-Felder), letzte Nachricht und
     * Ungelesen-Zähler — nach letzter Aktivität sortiert (leere Konversationen ans Ende). Der
     * Controller baut daraus via {@see ChatPresenter} die DTOs.
     *
     * @return list<array{conv:array<string,mixed>,last:?array<string,mixed>,unread:int}>
     */
    public function listConversations(int $viewerId): array
    {
        if ($viewerId <= 0) {
            return [];
        }
        $convs = $this->visibleConversations($viewerId);
        if ($convs === []) {
            return [];
        }

        $ids      = array_map(static fn (array $c): int => (int) $c['id'], $convs);
        $lastMsgs = $this->lastMessages($ids);
        $unread   = $this->unreadCounts($ids, $viewerId);

        $items = array_map(static fn (array $c): array => [
            'conv'   => $c,
            'last'   => $lastMsgs[(int) $c['id']] ?? null,
            'unread' => $unread[(int) $c['id']] ?? 0,
        ], $convs);

        usort($items, static fn (array $a, array $b): int => strcmp(
            (string) ($b['conv']['last_message_at'] ?? ''),
            (string) ($a['conv']['last_message_at'] ?? ''),
        ));

        return $items;
    }

    /** Aggregierter Ungelesen-Zähler (Summe über alle sichtbaren Konversationen) fürs Nav-Badge. */
    public function unreadTotal(int $viewerId): int
    {
        if ($viewerId <= 0) {
            return 0;
        }
        $ids = array_map(static fn (array $c): int => (int) $c['id'], $this->visibleConversations($viewerId));

        return array_sum($this->unreadCounts($ids, $viewerId));
    }

    /**
     * Die sichtbaren Konversationen des Betrachters (DMs ∪ Channels eigener aktiver Gruppen∩`min_role`
     * ∪ eigene Treffen-Chats), je mit `title`, `last_message_at`, `my_last_read` und (DM) Peer-Feldern.
     *
     * @return list<array<string, mixed>>
     */
    private function visibleConversations(int $viewerId): array
    {
        $db = db_connect();

        $dms = $db->query(
            "SELECT c.id, c.type, c.context_id, c.last_message_at,
                    peer.user_id AS peer_id, pp.display_name AS peer_display_name, pp.handle AS peer_handle, pp.avatar_path AS peer_avatar,
                    pp.display_name AS title
             FROM conversations c
             JOIN conversation_participants me ON me.conversation_id = c.id AND me.user_id = ?
             JOIN conversation_participants peer ON peer.conversation_id = c.id AND peer.user_id <> ?
             JOIN profiles pp ON pp.user_id = peer.user_id
             WHERE c.type = 'direct' AND c.deleted_at IS NULL",
            [$viewerId, $viewerId],
        )->getResultArray();

        $channels = $db->query(
            "SELECT c.id, c.type, c.context_id, c.last_message_at,
                    NULL AS peer_id, NULL AS peer_display_name, NULL AS peer_handle, NULL AS peer_avatar,
                    CONCAT(g.name, ' · ', c.title) AS title
             FROM conversations c
             JOIN group_members gm ON gm.group_id = c.context_id AND gm.user_id = ? AND gm.status = 'active'
             JOIN `groups` g ON g.id = c.context_id
             WHERE c.type = 'group_channel' AND c.deleted_at IS NULL
               AND (c.min_role = 'member' OR gm.role IN ('owner','admin'))",
            [$viewerId],
        )->getResultArray();

        $meetups = $db->query(
            "SELECT c.id, c.type, c.context_id, c.last_message_at,
                    NULL AS peer_id, NULL AS peer_display_name, NULL AS peer_handle, NULL AS peer_avatar,
                    m.title AS title
             FROM conversations c
             JOIN meetup_participants mp ON mp.meetup_id = c.context_id AND mp.user_id = ?
             JOIN meetups m ON m.id = c.context_id
             WHERE c.type = 'meetup' AND c.deleted_at IS NULL",
            [$viewerId],
        )->getResultArray();

        return array_merge($dms, $channels, $meetups);
    }

    /**
     * Letzte Nachricht je Konversation (für die Sidebar-Vorschau), inkl. Absendername.
     *
     * @param list<int> $convIds
     * @return array<int, array<string, mixed>>
     */
    private function lastMessages(array $convIds): array
    {
        if ($convIds === []) {
            return [];
        }
        $in   = implode(',', array_map('intval', $convIds));
        $rows = db_connect()->query(
            "SELECT m.conversation_id, m.body, m.deleted_at, m.created_at, p.display_name AS sender_name
             FROM messages m
             JOIN profiles p ON p.user_id = m.sender_id
             JOIN (SELECT conversation_id, MAX(id) AS max_id FROM messages WHERE conversation_id IN ({$in}) GROUP BY conversation_id) last
               ON last.conversation_id = m.conversation_id AND last.max_id = m.id",
        )->getResultArray();

        $map = [];
        foreach ($rows as $r) {
            $map[(int) $r['conversation_id']] = $r;
        }

        return $map;
    }

    /**
     * Ungelesen-Zähler je Konversation: nicht-gelöschte Fremdnachrichten oberhalb des eigenen
     * Watermarks (`last_read_message_id`; 0, falls noch keine Teilnehmer-Zeile existiert).
     *
     * @param list<int> $convIds
     * @return array<int, int>
     */
    private function unreadCounts(array $convIds, int $viewerId): array
    {
        if ($convIds === []) {
            return [];
        }
        $in   = implode(',', array_map('intval', $convIds));
        $rows = db_connect()->query(
            "SELECT m.conversation_id, COUNT(*) AS cnt
             FROM messages m
             LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = ?
             WHERE m.conversation_id IN ({$in}) AND m.deleted_at IS NULL AND m.sender_id <> ?
               AND m.id > COALESCE(cp.last_read_message_id, 0)
             GROUP BY m.conversation_id",
            [$viewerId, $viewerId],
        )->getResultArray();

        $map = [];
        foreach ($rows as $r) {
            $map[(int) $r['conversation_id']] = (int) $r['cnt'];
        }

        return $map;
    }

    // ──────────────────────────── Detail / Verlauf ────────────────────────────

    /**
     * Detail-Daten (nach Zugriffsprüfung): Konversation (mit `title`), Peer-Profil (DM), Teilnehmer-
     * Profile, Ersteller-ID (Treffen). Der Controller baut daraus die DTOs.
     *
     * @return array{conv:array<string,mixed>,peer:?array<string,mixed>,participants:list<array<string,mixed>>,creator_user_id:?int}
     * @throws ApiException not_found | not_a_participant
     */
    public function detail(int $convId, int $viewerId): array
    {
        $conv          = $this->assertAccess($convId, $viewerId);
        $conv['title'] = $this->titleFor($conv, $viewerId);

        return [
            'conv'            => $conv,
            'peer'            => $conv['type'] === 'direct' ? $this->peerProfile($convId, $viewerId) : null,
            'participants'    => $this->participants($conv),
            'creator_user_id' => $conv['type'] === 'meetup' ? $this->meetupCreator((int) $conv['context_id']) : null,
        ];
    }

    /**
     * Voller Verlauf (nach Zugriffsprüfung): Nachrichten (mit Absenderprofil), Reaktions-Aggregat,
     * Reply-Vorschauen und die Ersteller-ID (für `is_creator` bei Treffen-Chats).
     *
     * @return array{rows:list<array<string,mixed>>,reactions:array<int,list<array<string,mixed>>>,replies:array<int,array<string,mixed>>,creator_id:?int}
     * @throws ApiException not_found | not_a_participant
     */
    public function messages(int $convId, int $viewerId): array
    {
        $conv = $this->assertAccess($convId, $viewerId);

        $rows = db_connect()->table('messages m')
            ->select('m.id, m.conversation_id, m.sender_id, m.body, m.reply_to_id, m.edited_at, m.deleted_at, m.created_at', false)
            ->select('p.display_name AS sender_display_name, p.handle AS sender_handle, p.avatar_path AS sender_avatar', false)
            ->join('profiles p', 'p.user_id = m.sender_id')
            ->where('m.conversation_id', $convId)
            ->orderBy('m.id', 'ASC')
            ->get()->getResultArray();

        $messageIds = array_map(static fn (array $r): int => (int) $r['id'], $rows);

        return [
            'rows'       => $rows,
            'reactions'  => $this->reactionsFor($messageIds, $viewerId),
            'replies'    => $this->replyPreviews($rows),
            'creator_id' => $conv['type'] === 'meetup' ? $this->meetupCreator((int) $conv['context_id']) : null,
        ];
    }

    /**
     * Aggregierte Reaktionen je Nachricht (`{emoji,count,me}`), `me` bezogen auf den Betrachter.
     *
     * @param list<int> $messageIds
     * @return array<int, list<array{emoji:string,count:int,me:bool}>>
     */
    public function reactionsFor(array $messageIds, int $viewerId): array
    {
        if ($messageIds === []) {
            return [];
        }
        $rows = db_connect()->table('message_reactions')
            ->select("message_id, emoji, COUNT(*) AS cnt, MAX(CASE WHEN user_id = {$viewerId} THEN 1 ELSE 0 END) AS me", false)
            ->whereIn('message_id', $messageIds)
            ->groupBy(['message_id', 'emoji'])
            ->orderBy('cnt', 'DESC')->orderBy('emoji', 'ASC')
            ->get()->getResultArray();

        $map = [];
        foreach ($rows as $r) {
            $map[(int) $r['message_id']][] = ['emoji' => $r['emoji'], 'count' => (int) $r['cnt'], 'me' => (bool) $r['me']];
        }

        return $map;
    }

    /**
     * Reply-Vorschauen für alle referenzierten Ziel-Nachrichten (`reply_to_id` → `{id,sender_name,body}`).
     *
     * @param list<array<string, mixed>> $rows
     * @return array<int, array{id:int,sender_name:string,body:?string}>
     */
    private function replyPreviews(array $rows): array
    {
        $targetIds = [];
        foreach ($rows as $r) {
            if ($r['reply_to_id'] !== null) {
                $targetIds[(int) $r['reply_to_id']] = true;
            }
        }
        if ($targetIds === []) {
            return [];
        }

        $targets = db_connect()->table('messages m')
            ->select('m.id, m.body, m.deleted_at, p.display_name AS sender_name', false)
            ->join('profiles p', 'p.user_id = m.sender_id')
            ->whereIn('m.id', array_keys($targetIds))
            ->get()->getResultArray();

        $present = new ChatPresenter();
        $map     = [];
        foreach ($targets as $t) {
            $map[(int) $t['id']] = $present->replyPreview($t);
        }

        return $map;
    }

    // ──────────────────────────── Schreiben ────────────────────────────

    /**
     * Nachricht senden. Schreibrecht = Teilnahme (Channels zusätzlich `min_role`, via {@see assertAccess}).
     * `reply_to_id` muss derselben Konversation gehören. Aktualisiert `last_message_at` und zieht den
     * Sender-Watermark mit (eigene Nachricht gilt als gelesen). Liefert die neue Nachrichten-ID.
     *
     * @throws ApiException not_found | not_a_participant | reply_target_not_found
     */
    public function sendMessage(int $viewerId, int $convId, string $body, ?int $replyToId): int
    {
        $conv = $this->assertAccess($convId, $viewerId);

        if ($replyToId !== null
            && db_connect()->table('messages')->where('id', $replyToId)->where('conversation_id', $convId)->countAllResults() === 0) {
            throw new ApiException('reply_target_not_found', 'Die zitierte Nachricht existiert nicht.', 409);
        }

        $id = (int) model(MessageModel::class)->insert([
            'conversation_id' => $convId,
            'sender_id'       => $viewerId,
            'body'            => $body,
            'reply_to_id'     => $replyToId,
        ], true);

        db_connect()->table('conversations')->where('id', $convId)->update(['last_message_at' => gmdate('Y-m-d H:i:s')]);
        $this->upsertParticipant($convId, $viewerId, $id);

        // Benachrichtigung an die übrigen (nicht stummgeschalteten) Teilnehmer — aggregiert je Konversation.
        (new NotificationService())->notifyNewMessage($this->recipientsFor($conv, $viewerId), $convId, $viewerId);

        return $id;
    }

    /**
     * Eigene Nachricht bearbeiten (Soft-Edit). Nur Sender, nicht gelöscht, innerhalb 15 min ab
     * `created_at` (ADR-012/C6).
     *
     * @throws ApiException not_found | forbidden | message_deleted | edit_window_expired
     */
    public function editMessage(int $viewerId, int $convId, int $messageId, string $body): int
    {
        $msg = $this->requireMessage($convId, $messageId);
        if ((int) $msg['sender_id'] !== $viewerId) {
            throw new ApiException('forbidden', 'Du kannst nur eigene Nachrichten bearbeiten.', 403);
        }
        if ($msg['deleted_at'] !== null) {
            throw new ApiException('message_deleted', 'Gelöschte Nachrichten können nicht bearbeitet werden.', 409);
        }
        if ($this->ageInSeconds((string) $msg['created_at']) > 900) {
            throw new ApiException('edit_window_expired', 'Das Zeitfenster zum Bearbeiten (15 Minuten) ist abgelaufen.', 409);
        }

        model(MessageModel::class)->update($messageId, ['body' => $body, 'edited_at' => gmdate('Y-m-d H:i:s')]);

        return $messageId;
    }

    /**
     * Nachricht soft-löschen (Tombstone). Sender **oder** Konversations-owner/admin (Channel =
     * Gruppen-owner/admin, Treffen = Ersteller). `body` bleibt für Audit in der DB, der Presenter
     * liefert `null`. Idempotent.
     *
     * @throws ApiException not_found | forbidden
     */
    public function deleteMessage(int $viewerId, int $convId, int $messageId): int
    {
        $msg  = $this->requireMessage($convId, $messageId);
        $conv = $this->requireConversation($convId);
        if ((int) $msg['sender_id'] !== $viewerId && ! $this->isConversationModerator($conv, $viewerId)) {
            throw new ApiException('forbidden', 'Dazu fehlt dir die Berechtigung.', 403);
        }
        if ($msg['deleted_at'] === null) {
            model(MessageModel::class)->update($messageId, ['deleted_at' => gmdate('Y-m-d H:i:s'), 'deleted_by' => $viewerId]);
        }

        return $messageId;
    }

    /**
     * Emoji-Reaktion togglen (Teilnehmer, nicht auf gelöschte Nachrichten; Server-Allowlist). Stößt
     * `messages.updated_at` an, damit das Polling-Delta die Änderung erkennt.
     *
     * @throws ApiException not_found | not_a_participant | message_deleted | invalid_emoji
     */
    public function reactToMessage(int $viewerId, int $convId, int $messageId, string $emoji): int
    {
        $this->assertAccess($convId, $viewerId);
        $msg = $this->requireMessage($convId, $messageId);
        if ($msg['deleted_at'] !== null) {
            throw new ApiException('message_deleted', 'Auf gelöschte Nachrichten kann nicht reagiert werden.', 409);
        }
        if (! in_array($emoji, self::ALLOWED_EMOJIS, true)) {
            throw new ApiException('invalid_emoji', 'Dieses Emoji ist nicht erlaubt.', 422);
        }

        $db       = db_connect();
        $existing = $db->table('message_reactions')
            ->where('message_id', $messageId)->where('user_id', $viewerId)->where('emoji', $emoji)
            ->get()->getRowArray();
        if ($existing !== null) {
            $db->table('message_reactions')->where('id', $existing['id'])->delete();
        } else {
            model(MessageReactionModel::class)->insert(['message_id' => $messageId, 'user_id' => $viewerId, 'emoji' => $emoji]);
            // Nur beim Hinzufügen den Autor benachrichtigen (nicht bei eigener Reaktion).
            $authorId = (int) $msg['sender_id'];
            if ($authorId !== $viewerId) {
                (new NotificationService())->create($authorId, 'message_reaction', $viewerId, 'conversation', $convId, ['emoji' => $emoji]);
            }
        }
        // Reaktionen ändern die messages-Zeile nicht ⇒ updated_at explizit anstoßen (Polling-Delta).
        $db->table('messages')->where('id', $messageId)->set('updated_at', 'CURRENT_TIMESTAMP(3)', false)->update();

        return $messageId;
    }

    /**
     * Alles als gelesen markieren: Watermark = letzte Nachricht der Konversation.
     *
     * @throws ApiException not_found | not_a_participant
     */
    public function markRead(int $viewerId, int $convId): void
    {
        $this->assertAccess($convId, $viewerId);
        $row    = db_connect()->table('messages')->selectMax('id')->where('conversation_id', $convId)->get()->getRowArray();
        $lastId = ($row !== null && $row['id'] !== null) ? (int) $row['id'] : null;
        $this->upsertParticipant($convId, $viewerId, $lastId);

        // Aggregierte „neue Nachricht"-Benachrichtigung dieser Konversation auflösen (ADR-012/C7).
        (new NotificationService())->resolveConversation($viewerId, $convId);
    }

    /**
     * DM finden oder anlegen (deterministischer `dm_key = min:max`, idempotent + race-fest via
     * `uq_conv_dm_key`). Liefert die Konversations-ID.
     *
     * @throws ApiException cannot_dm_self | user_not_found | internal_error
     */
    public function openDm(int $viewerId, int $targetUserId): int
    {
        if ($targetUserId === $viewerId) {
            throw new ApiException('cannot_dm_self', 'Du kannst dir nicht selbst schreiben.', 409);
        }
        if (db_connect()->table('profiles')->where('user_id', $targetUserId)->countAllResults() === 0) {
            throw new ApiException('user_not_found', 'Nutzer nicht gefunden.', 404);
        }

        $dmKey    = min($viewerId, $targetUserId) . ':' . max($viewerId, $targetUserId);
        $existing = db_connect()->table('conversations')->where('dm_key', $dmKey)->where('deleted_at', null)->get()->getRowArray();
        if ($existing !== null) {
            return (int) $existing['id'];
        }

        $db = db_connect();
        $db->transBegin();
        try {
            $convId = (int) model(ConversationModel::class)->insert(['type' => 'direct', 'dm_key' => $dmKey, 'created_by' => $viewerId], true);
            model(ConversationParticipantModel::class)->insertBatch([
                ['conversation_id' => $convId, 'user_id' => $viewerId, 'role' => 'member'],
                ['conversation_id' => $convId, 'user_id' => $targetUserId, 'role' => 'member'],
            ]);
            $db->transCommit();

            return $convId;
        } catch (Throwable $e) {
            $db->transRollback();
            // Race: parallele Anlage → uq_conv_dm_key greift, die existierende Zeile lesen.
            $row = db_connect()->table('conversations')->where('dm_key', $dmKey)->get()->getRowArray();
            if ($row !== null) {
                return (int) $row['id'];
            }
            log_message('error', 'openDm failed: ' . $e->getMessage());
            throw new ApiException('internal_error', 'Direktnachricht konnte nicht geöffnet werden.', 500);
        }
    }

    /**
     * Einzelne Nachricht presenter-fertig (Antwort von send/edit/delete/react).
     *
     * @return array{row:array<string,mixed>,reactions:list<array<string,mixed>>,reply:?array<string,mixed>,is_creator:bool}
     * @throws ApiException not_found
     */
    public function singleMessage(int $convId, int $messageId, int $viewerId): array
    {
        $row = db_connect()->table('messages m')
            ->select('m.id, m.conversation_id, m.sender_id, m.body, m.reply_to_id, m.edited_at, m.deleted_at, m.created_at', false)
            ->select('p.display_name AS sender_display_name, p.handle AS sender_handle, p.avatar_path AS sender_avatar', false)
            ->join('profiles p', 'p.user_id = m.sender_id')
            ->where('m.id', $messageId)->where('m.conversation_id', $convId)
            ->get()->getRowArray();
        if ($row === null) {
            throw new ApiException('not_found', 'Nachricht nicht gefunden.', 404);
        }

        $conv      = $this->requireConversation($convId);
        $creatorId = $conv['type'] === 'meetup' ? $this->meetupCreator((int) $conv['context_id']) : null;

        return [
            'row'        => $row,
            'reactions'  => $this->reactionsFor([$messageId], $viewerId)[$messageId] ?? [],
            'reply'      => $row['reply_to_id'] !== null ? ($this->replyPreviews([$row])[(int) $row['reply_to_id']] ?? null) : null,
            'is_creator' => $creatorId !== null && (int) $row['sender_id'] === $creatorId,
        ];
    }

    // ──────────────────────────── Helpers ────────────────────────────

    /**
     * @return array<string, mixed>
     * @throws ApiException not_found
     */
    private function requireMessage(int $convId, int $messageId): array
    {
        $row = db_connect()->table('messages')->where('id', $messageId)->where('conversation_id', $convId)->get()->getRowArray();
        if ($row === null) {
            throw new ApiException('not_found', 'Nachricht nicht gefunden.', 404);
        }

        return $row;
    }

    /** Löschrecht über Sender hinaus: Channel = Gruppen-owner/admin; Treffen = Ersteller; DM = niemand. */
    private function isConversationModerator(array $conv, int $viewerId): bool
    {
        return match ($conv['type']) {
            'group_channel' => $this->isGroupOwnerOrAdmin((int) $conv['context_id'], $viewerId),
            'meetup'        => $this->meetupCreator((int) $conv['context_id']) === $viewerId,
            default         => false,
        };
    }

    private function isGroupOwnerOrAdmin(int $groupId, int $userId): bool
    {
        $gm = db_connect()->table('group_members')
            ->select('role')->where('group_id', $groupId)->where('user_id', $userId)->where('status', 'active')
            ->get()->getRowArray();

        return $gm !== null && in_array($gm['role'], ['owner', 'admin'], true);
    }

    /** Alter einer Nachricht in Sekunden (created_at ist UTC; ms werden abgeschnitten). */
    private function ageInSeconds(string $createdAt): int
    {
        $stamp = strtotime(explode('.', $createdAt)[0] . ' UTC');

        return $stamp === false ? PHP_INT_MAX : (time() - $stamp);
    }

    /** Teilnehmer-Zeile anlegen/aktualisieren (Watermark). Bei Channels/Treffen lazy materialisiert. */
    private function upsertParticipant(int $convId, int $userId, ?int $lastReadId): void
    {
        $db       = db_connect();
        $existing = $db->table('conversation_participants')->where('conversation_id', $convId)->where('user_id', $userId)->get()->getRowArray();
        $now      = gmdate('Y-m-d H:i:s');

        if ($existing !== null) {
            if ($lastReadId !== null) {
                $db->table('conversation_participants')->where('id', $existing['id'])->update(['last_read_message_id' => $lastReadId, 'last_read_at' => $now]);
            }

            return;
        }

        model(ConversationParticipantModel::class)->insert([
            'conversation_id'      => $convId,
            'user_id'              => $userId,
            'role'                 => 'member',
            'last_read_message_id' => $lastReadId,
            'last_read_at'         => $lastReadId !== null ? $now : null,
        ]);
    }

    /** @param array<string, mixed> $conv */
    private function titleFor(array $conv, int $viewerId): string
    {
        return match ($conv['type']) {
            'direct'        => (string) ($this->peerProfile((int) $conv['id'], $viewerId)['display_name'] ?? 'Direktnachricht'),
            'meetup'        => (string) (db_connect()->table('meetups')->select('title')->where('id', $conv['context_id'])->get()->getRowArray()['title'] ?? 'Treffen'),
            'group_channel' => ($this->groupName((int) $conv['context_id'])) . ' · ' . $conv['title'],
            default         => (string) ($conv['title'] ?? ''),
        };
    }

    private function groupName(int $groupId): string
    {
        $row = db_connect()->table('groups')->select('name')->where('id', $groupId)->get()->getRowArray();

        return (string) ($row['name'] ?? 'Gruppe');
    }

    /** @return array<string, mixed>|null */
    private function peerProfile(int $convId, int $viewerId): ?array
    {
        return db_connect()->table('conversation_participants cp')
            ->select('p.user_id, p.display_name, p.handle, p.avatar_path', false)
            ->join('profiles p', 'p.user_id = cp.user_id')
            ->where('cp.conversation_id', $convId)->where('cp.user_id !=', $viewerId)
            ->get()->getRowArray();
    }

    /**
     * Teilnehmer-Profile je Konversationstyp (DM = cp-Zeilen, Channel = aktive Gruppenmitglieder,
     * Treffen = Treffen-Teilnehmer).
     *
     * @param array<string, mixed> $conv
     * @return list<array<string, mixed>>
     */
    private function participants(array $conv): array
    {
        return match ($conv['type']) {
            'direct' => db_connect()->table('conversation_participants cp')
                ->select('p.user_id, p.display_name, p.handle, p.avatar_path', false)
                ->join('profiles p', 'p.user_id = cp.user_id')
                ->where('cp.conversation_id', $conv['id'])
                ->orderBy('cp.id', 'ASC')->get()->getResultArray(),
            'group_channel' => db_connect()->table('group_members gm')
                ->select('p.user_id, p.display_name, p.handle, p.avatar_path', false)
                ->join('profiles p', 'p.user_id = gm.user_id')
                ->where('gm.group_id', $conv['context_id'])->where('gm.status', 'active')
                ->orderBy("FIELD(gm.role,'owner','admin','moderator','member')", '', false)
                ->orderBy('gm.joined_at', 'ASC')->get()->getResultArray(),
            'meetup' => db_connect()->table('meetup_participants mp')
                ->select('p.user_id, p.display_name, p.handle, p.avatar_path', false)
                ->join('profiles p', 'p.user_id = mp.user_id')
                ->where('mp.meetup_id', $conv['context_id'])
                ->orderBy('mp.id', 'ASC')->get()->getResultArray(),
            default => [],
        };
    }

    private function meetupCreator(int $meetupId): ?int
    {
        $row = db_connect()->table('meetups')->select('creator_user_id')->where('id', $meetupId)->get()->getRowArray();

        return $row === null ? null : (int) $row['creator_user_id'];
    }

    /**
     * Empfänger für Benachrichtigungen: zugriffsberechtigte Teilnehmer ohne `$exceptId` und ohne
     * stummgeschaltete (`conversation_participants.muted`). **Wichtig:** für `min_role='admin'`-Channels
     * dieselbe Rollen-Schranke wie {@see canAccessChannel}/{@see visibleConversations} anwenden — sonst
     * bekämen member/moderator eine Benachrichtigung über einen Channel, den sie gar nicht lesen dürfen
     * (BOLA-Leak: Existenz + Actor-Identität + toter `/chat/{id}`-Link).
     *
     * @param array<string, mixed> $conv
     * @return list<int>
     */
    private function recipientsFor(array $conv, int $exceptId): array
    {
        $rows = ($conv['type'] === 'group_channel' && $conv['min_role'] === 'admin')
            ? db_connect()->table('group_members')
                ->select('user_id')
                ->where('group_id', $conv['context_id'])->where('status', 'active')->whereIn('role', ['owner', 'admin'])
                ->get()->getResultArray()
            : $this->participants($conv);

        $ids = array_values(array_filter(
            array_map(static fn (array $p): int => (int) $p['user_id'], $rows),
            static fn (int $id): bool => $id !== $exceptId,
        ));
        if ($ids === []) {
            return [];
        }

        $muted = array_map(
            static fn (array $r): int => (int) $r['user_id'],
            db_connect()->table('conversation_participants')
                ->select('user_id')->where('conversation_id', $conv['id'])->where('muted', 1)->whereIn('user_id', $ids)
                ->get()->getResultArray(),
        );

        return array_values(array_diff($ids, $muted));
    }
}
