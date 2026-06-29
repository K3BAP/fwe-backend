<?php

namespace App\Controllers\Api\V1;

use App\Controllers\Api\BaseApiController;
use App\Exceptions\ApiException;
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

        $present = new GroupPresenter();

        return $this->respondData(array_map(
            fn (array $c): array => $present->channel($c),
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
        ];
    }
}
