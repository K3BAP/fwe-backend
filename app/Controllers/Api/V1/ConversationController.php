<?php

namespace App\Controllers\Api\V1;

use App\Controllers\Api\BaseApiController;
use App\Exceptions\ApiException;
use App\Services\ChatPresenter;
use App\Services\ChatService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Chat-Konversationen + Nachrichten (API.md §9–10, ADR-005). Alle Routen liegen im Auth-Filter (privat).
 * Der Controller bleibt dünn: Request → Service (Zugriff/BOLA) → Presenter → Envelope. Gepollte GETs
 * (Liste/Verlauf/Zähler) nutzen {@see BaseApiController::respondMaybeCached} (ETag/304). Writes: Slice 3.
 */
final class ConversationController extends BaseApiController
{
    /** GET /conversations — Sidebar-Liste (DMs ∪ Channels ∪ Treffen-Chats), nach Aktivität sortiert. */
    public function index(): ResponseInterface
    {
        $present = new ChatPresenter();
        $items   = (new ChatService())->listConversations($this->currentUserId());

        return $this->respondMaybeCached(array_map(static function (array $it) use ($present): array {
            $c    = $it['conv'];
            $peer = $c['peer_id'] !== null
                ? $present->userCard((int) $c['peer_id'], $c['peer_display_name'], $c['peer_handle'], $c['peer_avatar'])
                : null;

            return $present->listItem($c, $it['last'], (int) $it['unread'], $peer);
        }, $items));
    }

    /** GET /conversations/unread-count — Aggregat-Zähler fürs Nav-Badge (bare Zahl). */
    public function unreadCount(): ResponseInterface
    {
        return $this->respondMaybeCached((new ChatService())->unreadTotal($this->currentUserId()));
    }

    /** GET /conversations/{id} — Metadaten + Teilnehmer (nur Teilnehmer). */
    public function show($id): ResponseInterface
    {
        try {
            $d = (new ChatService())->detail((int) $id, $this->currentUserId());
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        $present  = new ChatPresenter();
        $peerCard = $d['peer'] !== null
            ? $present->userCard((int) $d['peer']['user_id'], $d['peer']['display_name'], $d['peer']['handle'], $d['peer']['avatar_path'])
            : null;
        $cards = array_map(
            static fn (array $p): array => $present->userCard((int) $p['user_id'], $p['display_name'], $p['handle'], $p['avatar_path']),
            $d['participants'],
        );

        return $this->respondData($present->detail($d['conv'], $peerCard, $cards, $d['creator_user_id']));
    }

    /** GET /conversations/{id}/messages — voller Verlauf inkl. Reaktionen/Reply/Tombstones (nur Teilnehmer). */
    public function messages($id): ResponseInterface
    {
        try {
            $m = (new ChatService())->messages((int) $id, $this->currentUserId());
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        $present = new ChatPresenter();

        return $this->respondMaybeCached(array_map(static function (array $row) use ($present, $m): array {
            $reactions = $m['reactions'][(int) $row['id']] ?? [];
            $reply     = $row['reply_to_id'] !== null ? ($m['replies'][(int) $row['reply_to_id']] ?? null) : null;
            $isCreator = $m['creator_id'] !== null && (int) $row['sender_id'] === $m['creator_id'];

            return $present->message($row, $reactions, $reply, $isCreator);
        }, $m['rows']));
    }
}
