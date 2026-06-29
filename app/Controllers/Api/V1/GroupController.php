<?php

namespace App\Controllers\Api\V1;

use App\Controllers\Api\BaseApiController;
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
}
