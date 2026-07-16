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

    /** POST /conversations/direct — DM finden oder anlegen. Request `{ user_id }` → `{ id }`. */
    public function openDm(): ResponseInterface
    {
        $input = $this->request->getJSON(true) ?? [];
        if (! $this->validateData($input, ['user_id' => 'required|is_natural_no_zero'], $this->validationMessages())) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, $this->validator->getErrors());
        }

        try {
            $id = (new ChatService())->openDm($this->currentUserId(), (int) $input['user_id']);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondData(['id' => $id]);
    }

    /** POST /conversations/{id}/messages — Nachricht senden. Request `{ body, reply_to_id? }` → Message (201). */
    public function sendMessage($id): ResponseInterface
    {
        $input = $this->request->getJSON(true) ?? [];
        if (! $this->validateData($input, ['body' => 'required|string|min_length[1]|max_length[4000]'], $this->validationMessages())) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, $this->validator->getErrors());
        }

        try {
            $service   = new ChatService();
            $messageId = $service->sendMessage($this->currentUserId(), (int) $id, trim((string) $input['body']), $this->replyToId($input));
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondMessage((int) $id, $messageId, 201);
    }

    /** PATCH /conversations/{id}/messages/{messageId} — Soft-Edit (nur Sender, 15 min). */
    public function editMessage($id, $messageId): ResponseInterface
    {
        $input = $this->request->getJSON(true) ?? [];
        if (! $this->validateData($input, ['body' => 'required|string|min_length[1]|max_length[4000]'], $this->validationMessages())) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, $this->validator->getErrors());
        }

        try {
            (new ChatService())->editMessage($this->currentUserId(), (int) $id, (int) $messageId, trim((string) $input['body']));
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondMessage((int) $id, (int) $messageId);
    }

    /** DELETE /conversations/{id}/messages/{messageId} — Soft-Delete → Tombstone-Message (kein 204). */
    public function deleteMessage($id, $messageId): ResponseInterface
    {
        try {
            (new ChatService())->deleteMessage($this->currentUserId(), (int) $id, (int) $messageId);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondMessage((int) $id, (int) $messageId);
    }

    /** POST /conversations/{id}/messages/{messageId}/reactions — Emoji-Toggle → Message. */
    public function reactToMessage($id, $messageId): ResponseInterface
    {
        $input = $this->request->getJSON(true) ?? [];
        $emoji = trim((string) ($input['emoji'] ?? ''));
        if ($emoji === '') {
            return $this->respondError('validation_error', 'Bitte ein Emoji angeben.', 422, ['emoji' => 'Bitte ein Emoji angeben.']);
        }

        try {
            (new ChatService())->reactToMessage($this->currentUserId(), (int) $id, (int) $messageId, $emoji);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondMessage((int) $id, (int) $messageId);
    }

    /** POST /conversations/{id}/read — alles als gelesen markieren (kein Body) → 204. */
    public function markRead($id): ResponseInterface
    {
        try {
            (new ChatService())->markRead($this->currentUserId(), (int) $id);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondNoContent();
    }

    /** Baut die Antwort einer Nachrichten-Mutation (send/edit/delete/react) als vollständige Message. */
    private function respondMessage(int $convId, int $messageId, int $status = 200): ResponseInterface
    {
        $m       = (new ChatService())->singleMessage($convId, $messageId, $this->currentUserId());
        $present = new ChatPresenter();

        return $this->respondData($present->message($m['row'], $m['reactions'], $m['reply'], $m['is_creator']), $status);
    }

    /** `reply_to_id` aus dem Request (null bei fehlend/0/leer). */
    private function replyToId(array $input): ?int
    {
        $raw = $input['reply_to_id'] ?? null;

        return $raw === null || $raw === '' || (int) $raw === 0 ? null : (int) $raw;
    }

    /**
     * Deutsche Validierungsmeldungen.
     *
     * @return array<string, array<string, string>>
     */
    private function validationMessages(): array
    {
        return [
            'user_id' => ['required' => 'Bitte einen Nutzer angeben.', 'is_natural_no_zero' => 'Ungültiger Nutzer.'],
            'body'    => ['required' => 'Bitte etwas schreiben.', 'min_length' => 'Bitte etwas schreiben.', 'max_length' => 'Nachricht ist zu lang (max. 4000 Zeichen).'],
        ];
    }
}
