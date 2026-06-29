<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\NotificationModel;
use Throwable;

/**
 * In-App-Benachrichtigungen (API.md §11, ADR-008). **Lesen**: Liste, unread-count, markRead/markAllRead
 * (BOLA: nur eigene). **Erzeugen** (domänenübergreifend, aus Meetup-/Gruppen-/Chat-Flows aufgerufen) ist
 * **best-effort**: Fehler werden geloggt, nicht geworfen — eine fehlgeschlagene Benachrichtigung darf die
 * auslösende Kernaktion nie zurückrollen. `new_message` wird **pro Konversation aggregiert** (eine
 * ungelesene Zeile, beim Lesen aufgelöst, ADR-012/C7).
 */
final class NotificationService
{
    // ──────────────────────────── Lesen ────────────────────────────

    /**
     * Benachrichtigungen des Nutzers (neueste zuerst), mit Actor-Profil-Join für den Presenter.
     *
     * @return list<array<string, mixed>>
     */
    public function list(int $userId): array
    {
        return db_connect()->table('notifications n')
            ->select('n.id, n.type, n.actor_user_id, n.context_type, n.context_id, n.data, n.read_at, n.created_at', false)
            ->select('p.display_name AS actor_display_name, p.handle AS actor_handle, p.avatar_path AS actor_avatar', false)
            ->join('profiles p', 'p.user_id = n.actor_user_id', 'left')
            ->where('n.user_id', $userId)
            ->orderBy('n.created_at', 'DESC')->orderBy('n.id', 'DESC')
            ->get()->getResultArray();
    }

    public function unreadCount(int $userId): int
    {
        return db_connect()->table('notifications')->where('user_id', $userId)->where('read_at', null)->countAllResults();
    }

    /**
     * Einzelne als gelesen markieren (BOLA: nur eigene).
     *
     * @throws ApiException not_found | forbidden
     */
    public function markRead(int $userId, int $id): void
    {
        $row = db_connect()->table('notifications')->where('id', $id)->get()->getRowArray();
        if ($row === null) {
            throw new ApiException('not_found', 'Benachrichtigung nicht gefunden.', 404);
        }
        if ((int) $row['user_id'] !== $userId) {
            throw new ApiException('forbidden', 'Dazu fehlt dir die Berechtigung.', 403);
        }
        if ($row['read_at'] === null) {
            db_connect()->table('notifications')->where('id', $id)->update(['read_at' => gmdate('Y-m-d H:i:s')]);
        }
    }

    public function markAllRead(int $userId): void
    {
        db_connect()->table('notifications')
            ->where('user_id', $userId)->where('read_at', null)
            ->update(['read_at' => gmdate('Y-m-d H:i:s')]);
    }

    // ──────────────────────────── Erzeugen (best-effort) ────────────────────────────

    /**
     * Eine Benachrichtigung anlegen. Best-effort: Fehler werden geloggt, nicht geworfen.
     *
     * @param array<string, mixed> $data Render-Payload (JSON)
     */
    public function create(int $userId, string $type, ?int $actorId, ?string $ctxType, ?int $ctxId, array $data = []): void
    {
        try {
            model(NotificationModel::class)->insert([
                'user_id'       => $userId,
                'type'          => $type,
                'actor_user_id' => $actorId,
                'context_type'  => $ctxType,
                'context_id'    => $ctxId,
                'data'          => $data === [] ? null : json_encode($data, JSON_UNESCAPED_UNICODE),
            ]);
        } catch (Throwable $e) {
            log_message('error', 'Notification create failed: ' . $e->getMessage());
        }
    }

    /**
     * `new_message`-Fan-out (aggregiert): je Empfänger **eine** ungelesene Zeile pro Konversation —
     * vorhandene ungelesene wird auf den neuen Actor/Zeitpunkt gehoben, sonst neu angelegt (ADR-012/C7).
     *
     * @param list<int> $recipientIds bereits ohne Sender/`muted`
     */
    public function notifyNewMessage(array $recipientIds, int $convId, int $actorId): void
    {
        try {
            $db  = db_connect();
            $now = gmdate('Y-m-d H:i:s');
            foreach ($recipientIds as $rid) {
                if ($rid === $actorId) {
                    continue;
                }
                $existing = $db->table('notifications')
                    ->where('user_id', $rid)->where('type', 'new_message')
                    ->where('context_type', 'conversation')->where('context_id', $convId)->where('read_at', null)
                    ->get()->getRowArray();
                if ($existing !== null) {
                    $db->table('notifications')->where('id', $existing['id'])->update(['actor_user_id' => $actorId, 'created_at' => $now]);
                } else {
                    model(NotificationModel::class)->insert([
                        'user_id' => $rid, 'type' => 'new_message', 'actor_user_id' => $actorId,
                        'context_type' => 'conversation', 'context_id' => $convId, 'data' => null,
                    ]);
                }
            }
        } catch (Throwable $e) {
            log_message('error', 'notifyNewMessage failed: ' . $e->getMessage());
        }
    }

    /** Beim Lesen einer Konversation: deren ungelesene `new_message`-Benachrichtigung auflösen. */
    public function resolveConversation(int $userId, int $convId): void
    {
        try {
            db_connect()->table('notifications')
                ->where('user_id', $userId)->where('type', 'new_message')
                ->where('context_type', 'conversation')->where('context_id', $convId)->where('read_at', null)
                ->update(['read_at' => gmdate('Y-m-d H:i:s')]);
        } catch (Throwable $e) {
            log_message('error', 'resolveConversation failed: ' . $e->getMessage());
        }
    }
}
