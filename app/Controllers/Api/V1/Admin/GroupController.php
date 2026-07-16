<?php

namespace App\Controllers\Api\V1\Admin;

use App\Controllers\Api\BaseApiController;
use App\Exceptions\ApiException;
use App\Services\Admin\AdminPresenter;
use App\Services\Admin\GroupAdminService;
use App\Services\Admin\UserLookup;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Gruppen-Sicht des Admin-Bereichs (ADR-019): Lesen über alle Sichtbarkeiten hinweg — inkl. privater
 * und soft-gelöschter Gruppen — plus das Gegenstück zum Soft-Delete. Bearbeiten/Löschen läuft über die
 * öffentlichen Routen (`$isAdmin`-Override im GroupService).
 */
final class GroupController extends BaseApiController
{
    /** GET /admin/groups */
    public function index(): ResponseInterface
    {
        $page = (new GroupAdminService())->list([
            'q'          => trim((string) $this->request->getGet('q')),
            'visibility' => $this->request->getGet('visibility'),
            'status'     => $this->request->getGet('status'),
            'sort'       => $this->request->getGet('sort'),
            'limit'      => $this->request->getGet('limit') ?? 20,
            'offset'     => $this->request->getGet('offset') ?? 0,
        ]);

        $owners = (new UserLookup())->cardsFor(array_map(
            static fn (array $row): int => (int) $row['owner_user_id'],
            $page['items']
        ));

        $presenter = new AdminPresenter();
        $items     = array_map(
            static fn (array $row): array => $presenter->groupRow($row, $owners[(int) $row['owner_user_id']] ?? null),
            $page['items']
        );

        return $this->respondData($items, 200, [
            'total'  => $page['total'],
            'limit'  => $page['limit'],
            'offset' => $page['offset'],
            'sort'   => $page['sort'],
        ]);
    }

    /** POST /admin/groups/{id}/restore — hebt den Soft-Delete auf (Gruppe + Channels). */
    public function restore(int $id): ResponseInterface
    {
        try {
            (new GroupAdminService())->restore($id);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondNoContent();
    }
}
