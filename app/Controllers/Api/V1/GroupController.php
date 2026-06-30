<?php

namespace App\Controllers\Api\V1;

use App\Controllers\Api\BaseApiController;
use App\Exceptions\ApiException;
use App\Services\ChatService;
use App\Services\GroupPresenter;
use App\Services\GroupService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Gruppen (API.md §6–8, 03-gruppen.md). Lesen ist sichtbarkeits-/rollenabhängig (Gäste sehen `public`);
 * Schreiben/Verwaltung (Slice 3–5) hängt am Auth-Filter. Der Controller bleibt dünn: Request →
 * Autorisierung → Service → Presenter → Envelope. Geschäftslogik liegt im {@see GroupService}.
 */
final class GroupController extends BaseApiController
{
    /** GET /groups — sichtbares Verzeichnis (unpaginiertes Array, Such-/Region-Filter client-seitig). */
    public function index(): ResponseInterface
    {
        $rows    = (new GroupService())->list($this->viewerId());
        $present = new GroupPresenter();

        return $this->respondData(array_map(fn (array $r): array => $present->listItem($r), $rows));
    }

    /** GET /groups/{id} — Detail/Metadaten (private Nicht-Mitglieder erhalten die Existenz-Karte). */
    public function show($id): ResponseInterface
    {
        return $this->respondDetail((int) $id);
    }

    /** GET /groups/{id}/members — Mitgliederliste (private nur für Mitglieder). */
    public function members($id): ResponseInterface
    {
        $service = new GroupService();
        $row     = $service->findRow((int) $id);
        if ($row === null) {
            return $this->groupNotFound();
        }
        $membership = $service->membershipOf((int) $id, $this->viewerId());
        if (! $this->canRead($row, $membership)) {
            return $this->forbidden();
        }

        $present = new GroupPresenter();

        return $this->respondData(array_map(fn (array $r): array => $present->member($r), $service->members((int) $id)));
    }

    /** GET /groups/{id}/feed — Feed (public/unlisted öffentlich; private nur für Mitglieder). */
    public function feed($id): ResponseInterface
    {
        $service = new GroupService();
        $row     = $service->findRow((int) $id);
        if ($row === null) {
            return $this->groupNotFound();
        }
        $membership = $service->membershipOf((int) $id, $this->viewerId());
        if (! $this->canRead($row, $membership)) {
            return $this->forbidden();
        }

        $posts     = $service->feedPosts((int) $id);
        $reactions = $service->reactionsFor(array_map(static fn (array $p): int => (int) $p['id'], $posts), $this->viewerId());
        $present   = new GroupPresenter();

        return $this->respondData(array_map(
            fn (array $p): array => $present->feedPost($p, $reactions[(int) $p['id']] ?? []),
            $posts,
        ));
    }

    /** GET /groups/{id}/join-requests — offene Anträge (owner/admin). */
    public function joinRequests($id): ResponseInterface
    {
        $service = new GroupService();
        $row     = $service->findRow((int) $id);
        if ($row === null) {
            return $this->groupNotFound();
        }
        if (! $this->canManage($service->membershipOf((int) $id, $this->viewerId()))) {
            return $this->forbidden();
        }

        $present = new GroupPresenter();

        return $this->respondData(array_map(fn (array $r): array => $present->joinRequest($r), $service->joinRequests((int) $id)));
    }

    /** GET /groups/{id}/invites — Einladungen (owner/admin). */
    public function invites($id): ResponseInterface
    {
        $service = new GroupService();
        $row     = $service->findRow((int) $id);
        if ($row === null) {
            return $this->groupNotFound();
        }
        if (! $this->canManage($service->membershipOf((int) $id, $this->viewerId()))) {
            return $this->forbidden();
        }

        $present = new GroupPresenter();

        return $this->respondData(array_map(fn (array $r): array => $present->invite($r), $service->invites((int) $id)));
    }

    /** GET /groups/{id}/channels — Channels (nur Mitglieder; admin-Channels nur owner/admin). */
    public function channels($id): ResponseInterface
    {
        $service = new GroupService();
        $row     = $service->findRow((int) $id);
        if ($row === null) {
            return $this->groupNotFound();
        }
        $membership = $service->membershipOf((int) $id, $this->viewerId());
        if ($membership === null && ! $this->isAdmin()) {
            return $this->forbidden();
        }

        return $this->respondData($this->presentChannels(
            $service->channels((int) $id, $membership, $this->isAdmin()),
        ));
    }

    // ──────────────────────────── Schreiben ────────────────────────────

    /** POST /groups — Gründen (§6.3). Auth; Ersteller wird Owner + Default-Channel. */
    public function store(): ResponseInterface
    {
        $input = $this->request->getJSON(true) ?? [];
        $rules = [
            'name'        => 'required|string|min_length[3]|max_length[80]',
            'description' => 'permit_empty|string|max_length[2000]',
            'region'      => 'permit_empty|string|max_length[80]',
            'rules_text'  => 'permit_empty|string|max_length[5000]',
            'visibility'  => 'required|in_list[public,private,unlisted]',
            'join_policy' => 'required|in_list[open,request,invite_only]',
        ];
        if (! $this->validateData($input, $rules, $this->validationMessages())) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, $this->validator->getErrors());
        }

        try {
            $id = (new GroupService())->create($this->currentUserId(), $input);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondDetail($id, 201);
    }

    /** PATCH /groups/{id} — Metadaten bearbeiten (§6.5). BOLA: owner/admin. */
    public function update($id): ResponseInterface
    {
        $input = $this->request->getJSON(true) ?? [];
        $rules = [
            'name'        => 'permit_empty|string|min_length[3]|max_length[80]',
            'description' => 'permit_empty|string|max_length[2000]',
            'region'      => 'permit_empty|string|max_length[80]',
            'rules_text'  => 'permit_empty|string|max_length[5000]',
            'visibility'  => 'permit_empty|in_list[public,private,unlisted]',
            'join_policy' => 'permit_empty|in_list[open,request,invite_only]',
        ];
        if (! $this->validateData($input, $rules, $this->validationMessages())) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, $this->validator->getErrors());
        }

        try {
            (new GroupService())->update((int) $id, $this->currentUserId(), $this->isAdmin(), $input);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondDetail((int) $id);
    }

    /** DELETE /groups/{id} — Soft-Delete (§6.6). Nur Owner. */
    public function destroy($id): ResponseInterface
    {
        try {
            (new GroupService())->delete((int) $id, $this->currentUserId(), $this->isAdmin());
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondNoContent();
    }

    /** POST /groups/{id}/members — Direkter Beitritt (§6.8, join_policy=open). */
    public function join($id): ResponseInterface
    {
        try {
            (new GroupService())->join((int) $id, $this->currentUserId());
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondDetail((int) $id);
    }

    /** DELETE /groups/{id}/members — Selbst-Austritt (§6.8b). */
    public function leave($id): ResponseInterface
    {
        try {
            (new GroupService())->leave((int) $id, $this->currentUserId());
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondDetail((int) $id);
    }

    /** POST /groups/{id}/join-requests — Beitrittsantrag (§6.11, join_policy=request). */
    public function requestJoin($id): ResponseInterface
    {
        $input = $this->request->getJSON(true) ?? [];
        if (! $this->validateData($input, ['message' => 'permit_empty|string|max_length[500]'], $this->validationMessages())) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, $this->validator->getErrors());
        }

        try {
            (new GroupService())->requestJoin((int) $id, $this->currentUserId(), $input['message'] ?? null);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondDetail((int) $id);
    }

    /** DELETE /groups/{id}/join-requests/mine — eigenen Antrag zurückziehen (§6.11b). */
    public function withdrawRequest($id): ResponseInterface
    {
        try {
            (new GroupService())->withdrawRequest((int) $id, $this->currentUserId());
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondDetail((int) $id);
    }

    // ──────────────────── Mitglieder-Verwaltung (→ GroupMember[]) ────────────────────

    /** PATCH /groups/{id}/members/{userId} — Rolle ändern (§6.9). */
    public function setMemberRole($id, $userId): ResponseInterface
    {
        $input = $this->request->getJSON(true) ?? [];
        if (! $this->validateData($input, ['role' => 'required|in_list[admin,moderator,member]'], $this->validationMessages())) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, $this->validator->getErrors());
        }

        try {
            (new GroupService())->setMemberRole((int) $id, $this->currentUserId(), $this->isAdmin(), (int) $userId, $input['role']);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondMembers((int) $id);
    }

    /** POST /groups/{id}/members/{userId}/ban — Ban umschalten (§6.9b). */
    public function toggleBan($id, $userId): ResponseInterface
    {
        try {
            (new GroupService())->toggleBan((int) $id, $this->currentUserId(), $this->isAdmin(), (int) $userId);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondMembers((int) $id);
    }

    /** DELETE /groups/{id}/members/{userId} — Mitglied kicken (§6.10). */
    public function removeMember($id, $userId): ResponseInterface
    {
        try {
            (new GroupService())->removeMember((int) $id, $this->currentUserId(), $this->isAdmin(), (int) $userId);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondMembers((int) $id);
    }

    /** POST /groups/{id}/transfer — Eigentum übertragen (§6.9c). */
    public function transfer($id): ResponseInterface
    {
        $input = $this->request->getJSON(true) ?? [];
        if (! $this->validateData($input, ['user_id' => 'required|is_natural_no_zero'], $this->validationMessages())) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, $this->validator->getErrors());
        }

        try {
            (new GroupService())->transferOwnership((int) $id, $this->currentUserId(), $this->isAdmin(), (int) $input['user_id']);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondMembers((int) $id);
    }

    // ──────────────────── Antrags-Entscheid (→ JoinRequest[]) ────────────────────

    /** POST /groups/{id}/join-requests/{requestId}/approve — genehmigen (§6.13). */
    public function approveRequest($id, $requestId): ResponseInterface
    {
        try {
            (new GroupService())->approveRequest((int) $id, $this->currentUserId(), $this->isAdmin(), (int) $requestId);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondJoinRequests((int) $id);
    }

    /** POST /groups/{id}/join-requests/{requestId}/reject — ablehnen (§6.13b). */
    public function rejectRequest($id, $requestId): ResponseInterface
    {
        try {
            (new GroupService())->rejectRequest((int) $id, $this->currentUserId(), $this->isAdmin(), (int) $requestId);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondJoinRequests((int) $id);
    }

    // ──────────────────── Einladungen (→ GroupInvite[]) ────────────────────

    /** POST /groups/{id}/invites — Token-Link oder gerichtete Einladung (§6.14). */
    public function createInvite($id): ResponseInterface
    {
        $input         = $this->request->getJSON(true) ?? [];
        $invitedUserId = isset($input['user_id']) ? (int) $input['user_id'] : null;

        try {
            (new GroupService())->createInvite((int) $id, $this->currentUserId(), $this->isAdmin(), $invitedUserId);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondInvites((int) $id);
    }

    /** DELETE /groups/{id}/invites/{inviteId} — widerrufen (§6.16). */
    public function revokeInvite($id, $inviteId): ResponseInterface
    {
        try {
            (new GroupService())->revokeInvite((int) $id, $this->currentUserId(), $this->isAdmin(), (int) $inviteId);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondInvites((int) $id);
    }

    /** GET /invites/{token} — öffentliche Vorschau (§6.17). */
    public function invitePreview($token): ResponseInterface
    {
        try {
            $p = (new GroupService())->invitePreview((string) $token);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondData([
            'group'     => (new GroupPresenter())->listItem($p['group']),
            'valid'     => $p['valid'],
            'expired'   => $p['expired'],
            'uses_left' => $p['uses_left'],
        ]);
    }

    /** POST /invites/{token}/accept — Token einlösen (§6.18). */
    public function acceptInvite($token): ResponseInterface
    {
        try {
            $groupId = (new GroupService())->acceptInvite((string) $token, $this->currentUserId());
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondData(['group_id' => $groupId, 'joined' => true], 201);
    }

    // ──────────────────── Channels (→ GroupChannel[]) ────────────────────

    /** POST /groups/{id}/channels — Channel anlegen (§7.2). */
    public function createChannel($id): ResponseInterface
    {
        $input = $this->request->getJSON(true) ?? [];
        if (! $this->validateData($input, ['name' => 'required|string|min_length[1]|max_length[80]'], $this->channelMessages())) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, $this->validator->getErrors());
        }

        try {
            (new GroupService())->createChannel((int) $id, $this->currentUserId(), $this->isAdmin(), $input['name']);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondChannels((int) $id);
    }

    /** PATCH /groups/{id}/channels/{channelId} — umbenennen (§7.3). */
    public function renameChannel($id, $channelId): ResponseInterface
    {
        $input = $this->request->getJSON(true) ?? [];
        if (! $this->validateData($input, ['name' => 'required|string|min_length[1]|max_length[80]'], $this->channelMessages())) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, $this->validator->getErrors());
        }

        try {
            (new GroupService())->renameChannel((int) $id, $this->currentUserId(), $this->isAdmin(), (int) $channelId, $input['name']);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondChannels((int) $id);
    }

    /** DELETE /groups/{id}/channels/{channelId} — soft-löschen (§7.4). */
    public function deleteChannel($id, $channelId): ResponseInterface
    {
        try {
            (new GroupService())->deleteChannel((int) $id, $this->currentUserId(), $this->isAdmin(), (int) $channelId);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondChannels((int) $id);
    }

    // ──────────────────── Feed-Writes (→ FeedPost) ────────────────────

    /** POST /groups/{id}/feed — Beitrag anlegen (§8.2). */
    public function createFeedPost($id): ResponseInterface
    {
        $input = $this->request->getJSON(true) ?? [];
        $rules = ['title' => 'permit_empty|string|max_length[150]', 'body' => 'required|string|min_length[1]|max_length[5000]'];
        if (! $this->validateData($input, $rules, $this->validationMessages())) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, $this->validator->getErrors());
        }

        try {
            $postId = (new GroupService())->createFeedPost((int) $id, $this->currentUserId(), $this->isAdmin(), $input);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondFeedPost((int) $id, $postId, 201);
    }

    /** PATCH /groups/{id}/feed/{postId} — bearbeiten (§8.3). */
    public function updateFeedPost($id, $postId): ResponseInterface
    {
        $input = $this->request->getJSON(true) ?? [];
        $rules = ['title' => 'permit_empty|string|max_length[150]', 'body' => 'permit_empty|string|max_length[5000]'];
        if (! $this->validateData($input, $rules, $this->validationMessages())) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, $this->validator->getErrors());
        }

        try {
            (new GroupService())->updateFeedPost((int) $id, $this->currentUserId(), $this->isAdmin(), (int) $postId, $input);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondFeedPost((int) $id, (int) $postId);
    }

    /** DELETE /groups/{id}/feed/{postId} — soft-löschen (§8.4, moderator+). */
    public function deleteFeedPost($id, $postId): ResponseInterface
    {
        try {
            (new GroupService())->deleteFeedPost((int) $id, $this->currentUserId(), $this->isAdmin(), (int) $postId);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondNoContent();
    }

    /** POST /groups/{id}/feed/{postId}/pin — Pin umschalten (§8.6). */
    public function togglePin($id, $postId): ResponseInterface
    {
        try {
            (new GroupService())->togglePin((int) $id, $this->currentUserId(), $this->isAdmin(), (int) $postId);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondFeedPost((int) $id, (int) $postId);
    }

    /** POST /groups/{id}/feed/{postId}/reactions — Emoji toggeln (§8.5). */
    public function reactToPost($id, $postId): ResponseInterface
    {
        $input = $this->request->getJSON(true) ?? [];
        if (! $this->validateData($input, ['emoji' => 'required|string|max_length[16]'], ['emoji' => ['required' => 'Bitte ein Emoji angeben.']])) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, $this->validator->getErrors());
        }

        try {
            (new GroupService())->reactToPost((int) $id, $this->currentUserId(), $this->isAdmin(), (int) $postId, $input['emoji']);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondFeedPost((int) $id, (int) $postId);
    }

    /** Aktualisierte Channel-Liste (Antwort der Channel-Endpunkte; Sicht des Akteurs). */
    private function respondChannels(int $id): ResponseInterface
    {
        $service    = new GroupService();
        $membership = $service->membershipOf($id, $this->viewerId());

        return $this->respondData($this->presentChannels($service->channels($id, $membership, $this->isAdmin())));
    }

    /**
     * Channel-Rohzeilen → DTOs mit echtem Ungelesen-Zähler (Watermark des Betrachters, {@see ChatService}).
     *
     * @param list<array<string, mixed>> $channels
     * @return list<array<string, mixed>>
     */
    private function presentChannels(array $channels): array
    {
        $present = new GroupPresenter();
        $ids     = array_map(static fn (array $c): int => (int) $c['id'], $channels);
        $unread  = (new ChatService())->unreadCounts($ids, $this->viewerId());

        return array_map(fn (array $c): array => $present->channel($c, $unread[(int) $c['id']] ?? 0), $channels);
    }

    /** Einzelner Feed-Post als Antwort (Create/Update/Pin/React). */
    private function respondFeedPost(int $groupId, int $postId, int $status = 200): ResponseInterface
    {
        $service = new GroupService();
        $post    = $service->findFeedPost($groupId, $postId);
        if ($post === null) {
            return $this->respondError('not_found', 'Beitrag nicht gefunden.', 404);
        }
        $reactions = $service->reactionsFor([$postId], $this->viewerId());

        return $this->respondData((new GroupPresenter())->feedPost($post, $reactions[$postId] ?? []), $status);
    }

    /** Aktualisierte Mitgliederliste (Antwort der Verwaltungs-Endpunkte). */
    private function respondMembers(int $id): ResponseInterface
    {
        $present = new GroupPresenter();

        return $this->respondData(array_map(fn (array $r): array => $present->member($r), (new GroupService())->members($id)));
    }

    /** Aktualisierte offene Anträge (Antwort der Entscheid-Endpunkte). */
    private function respondJoinRequests(int $id): ResponseInterface
    {
        $present = new GroupPresenter();

        return $this->respondData(array_map(fn (array $r): array => $present->joinRequest($r), (new GroupService())->joinRequests($id)));
    }

    /** Aktualisierte Einladungsliste (Antwort der Invite-Endpunkte). */
    private function respondInvites(int $id): ResponseInterface
    {
        $present = new GroupPresenter();

        return $this->respondData(array_map(fn (array $r): array => $present->invite($r), (new GroupService())->invites($id)));
    }

    /** Lädt die Gruppe frisch und gibt die volle Detail-Projektion zurück (Read + Write-Slices). */
    protected function respondDetail(int $id, int $status = 200): ResponseInterface
    {
        $service = new GroupService();
        $row     = $service->findRow($id);
        if ($row === null) {
            return $this->groupNotFound();
        }
        $viewer     = $this->viewerId();
        $membership = $service->membershipOf($id, $viewer);
        $detail     = (new GroupPresenter())->detail($row, $membership, $this->isAdmin(), $service->hasPendingRequest($id, $viewer));

        return $this->respondData($detail, $status);
    }

    /** Lese-Sichtbarkeit von feed/members: private nur für Mitglieder (public/unlisted für alle). */
    private function canRead(array $row, ?array $membership): bool
    {
        return $row['visibility'] !== 'private' || $membership !== null || $this->isAdmin();
    }

    /** Verwaltungsrecht: Site-Admin oder eigene Rolle owner/admin. */
    private function canManage(?array $membership): bool
    {
        return $this->isAdmin() || ($membership !== null && in_array($membership['role'], ['owner', 'admin'], true));
    }

    /** Betrachter-ID (0 für Gäste — Read-Routen liegen außerhalb des auth-Filters). */
    protected function viewerId(): int
    {
        return auth()->loggedIn() ? (int) auth()->id() : 0;
    }

    /** Shield-Group `admin` (Site-Admin-Override für BOLA/Sichtbarkeit). */
    protected function isAdmin(): bool
    {
        return auth()->loggedIn() && auth()->user()->inGroup('admin');
    }

    private function groupNotFound(): ResponseInterface
    {
        return $this->respondError('group_not_found', 'Gruppe nicht gefunden.', 404);
    }

    private function forbidden(): ResponseInterface
    {
        return $this->respondError('forbidden_role', 'Dazu fehlt dir die Berechtigung.', 403);
    }

    /**
     * Deutsche Validierungsmeldungen (spiegelt groupCreateInputSchema).
     *
     * @return array<string, array<string, string>>
     */
    private function validationMessages(): array
    {
        return [
            'name'        => ['required' => 'Bitte gib einen Namen an.', 'min_length' => 'Name muss mindestens 3 Zeichen lang sein.', 'max_length' => 'Name darf höchstens 80 Zeichen lang sein.'],
            'description' => ['max_length' => 'Beschreibung ist zu lang (max. 2000 Zeichen).'],
            'rules_text'  => ['max_length' => 'Regeltext ist zu lang (max. 5000 Zeichen).'],
            'visibility'  => ['required' => 'Bitte eine Sichtbarkeit wählen.', 'in_list' => 'Ungültige Sichtbarkeit.'],
            'join_policy' => ['required' => 'Bitte eine Beitrittsregel wählen.', 'in_list' => 'Ungültige Beitrittsregel.'],
            'message'     => ['max_length' => 'Nachricht ist zu lang (max. 500 Zeichen).'],
            'role'        => ['required' => 'Bitte eine Rolle angeben.', 'in_list' => 'Ungültige Rolle.'],
            'user_id'     => ['required' => 'Bitte einen Nutzer angeben.', 'is_natural_no_zero' => 'Ungültiger Nutzer.'],
            'title'       => ['max_length' => 'Titel ist zu lang (max. 150 Zeichen).'],
            'body'        => ['required' => 'Bitte etwas schreiben.', 'min_length' => 'Bitte etwas schreiben.', 'max_length' => 'Beitrag ist zu lang (max. 5000 Zeichen).'],
        ];
    }

    /**
     * Validierungsmeldungen für Channel-Namen (min. 1 Zeichen, anders als Gruppennamen).
     *
     * @return array<string, array<string, string>>
     */
    private function channelMessages(): array
    {
        return [
            'name' => ['required' => 'Bitte einen Channel-Namen angeben.', 'min_length' => 'Bitte einen Channel-Namen angeben.', 'max_length' => 'Channel-Name ist zu lang (max. 80 Zeichen).'],
        ];
    }
}
