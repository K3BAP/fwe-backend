<?php

namespace App\Controllers\Api\V1\Admin;

use App\Controllers\Api\BaseApiController;
use App\Exceptions\ApiException;
use App\Services\Admin\AdminPresenter;
use App\Services\Admin\UserAdminService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Benutzer-Verwaltung (ADR-019). Zugriff garantiert der `admin`-Filter; der Selbstschutz (kein
 * Selbst-Degradieren/-Sperren/-Löschen) liegt im {@see UserAdminService}.
 *
 * Jede schreibende Aktion antwortet mit dem **frischen Detail-DTO** statt mit `204`: das Frontend kann
 * die Zeile damit direkt aktualisieren, und wir umgehen die 204-Sonderbehandlung des PHP-Dev-Servers.
 */
final class UserController extends BaseApiController
{
    /** GET /admin/users — alle Konten, standardmäßig inkl. gelöschter. */
    public function index(): ResponseInterface
    {
        $page = (new UserAdminService())->list([
            'q'      => trim((string) $this->request->getGet('q')),
            'status' => $this->request->getGet('status'),
            'sort'   => $this->request->getGet('sort'),
            'limit'  => $this->request->getGet('limit') ?? 20,
            'offset' => $this->request->getGet('offset') ?? 0,
        ]);

        $presenter = new AdminPresenter();
        $items     = array_map(static fn (array $row): array => $presenter->userRow($row), $page['items']);

        return $this->respondData($items, 200, [
            'total'  => $page['total'],
            'limit'  => $page['limit'],
            'offset' => $page['offset'],
            'sort'   => $page['sort'],
        ]);
    }

    /** GET /admin/users/{id} */
    public function show(int $id): ResponseInterface
    {
        return $this->respondDetail($id);
    }

    /** PATCH /admin/users/{id} — Profil eines beliebigen Nutzers ändern (E-Mail bleibt read-only). */
    public function update(int $id): ResponseInterface
    {
        $rules = [
            'display_name'     => 'permit_empty|min_length[2]|max_length[80]',
            'handle'           => 'permit_empty|regex_match[/^[a-z0-9_]{3,30}$/]',
            'bio_markdown'     => 'permit_empty|max_length[2000]',
            'experience_level' => 'permit_empty|in_list[beginner,advanced,expert]',
            'license_class'    => 'permit_empty|max_length[60]',
            'glider'           => 'permit_empty|max_length[120]',
            'home_region'      => 'permit_empty|max_length[80]',
            'flight_hours'     => 'permit_empty|is_natural',
        ];
        $messages = [
            'display_name' => ['min_length' => 'Mindestens 2 Zeichen.', 'max_length' => 'Höchstens 80 Zeichen.'],
            'handle'       => ['regex_match' => 'Nur a–z, 0–9, _ (3–30 Zeichen).'],
            'bio_markdown' => ['max_length' => 'Höchstens 2000 Zeichen.'],
            'flight_hours' => ['is_natural' => 'Bitte eine Zahl ≥ 0 angeben.'],
        ];

        $input = $this->request->getJSON(true) ?? [];
        if (! $this->validateData($input, $rules, $messages)) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, $this->validator->getErrors());
        }

        try {
            (new UserAdminService())->updateProfile($id, $input);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondDetail($id);
    }

    /** POST /admin/users/{id}/admin — Body `{is_admin: bool}`. */
    public function setAdmin(int $id): ResponseInterface
    {
        $input = $this->request->getJSON(true) ?? [];
        if (! is_bool($input['is_admin'] ?? null)) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, ['is_admin' => 'Boolescher Wert erforderlich.']);
        }

        try {
            (new UserAdminService())->setAdmin($id, $this->currentUserId(), $input['is_admin']);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondDetail($id);
    }

    /** POST /admin/users/{id}/active — Body `{active: bool}`. */
    public function setActive(int $id): ResponseInterface
    {
        $input = $this->request->getJSON(true) ?? [];
        if (! is_bool($input['active'] ?? null)) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, ['active' => 'Boolescher Wert erforderlich.']);
        }

        try {
            (new UserAdminService())->setActive($id, $this->currentUserId(), $input['active']);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondDetail($id);
    }

    /** DELETE /admin/users/{id} — Soft-Delete (umkehrbar via restore). */
    public function destroy(int $id): ResponseInterface
    {
        try {
            (new UserAdminService())->softDelete($id, $this->currentUserId());
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondDetail($id);
    }

    /** POST /admin/users/{id}/restore */
    public function restore(int $id): ResponseInterface
    {
        try {
            (new UserAdminService())->restore($id);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondDetail($id);
    }

    /** Lädt den Nutzer frisch und liefert die Detail-Projektion (nach jedem Schreibvorgang). */
    private function respondDetail(int $id, int $status = 200): ResponseInterface
    {
        $row = (new UserAdminService())->findRow($id);
        if ($row === null) {
            return $this->respondError('not_found', 'Benutzer nicht gefunden.', 404);
        }

        return $this->respondData((new AdminPresenter())->userDetail($row, $this->currentUserId()), $status);
    }
}
