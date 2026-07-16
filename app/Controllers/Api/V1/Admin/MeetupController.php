<?php

namespace App\Controllers\Api\V1\Admin;

use App\Controllers\Api\BaseApiController;
use App\Services\Admin\AdminPresenter;
use App\Services\Admin\UserLookup;
use App\Services\MeetupService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Treffen-Sicht des Admin-Bereichs (ADR-019) — **nur Lesen**. Geschrieben (bearbeiten/absagen/löschen)
 * wird über die öffentlichen Routen, die Admins längst über den `$isAdmin`-BOLA-Override zulassen.
 *
 * Nutzt {@see MeetupService::list()} unverändert: Treffen haben weder Sichtbarkeit noch Soft-Delete —
 * die öffentliche Abfrage *ist* hier die Admin-Abfrage. Neu ist nur die Projektion (roher +
 * abgeleiteter Status, Ersteller).
 */
final class MeetupController extends BaseApiController
{
    /** GET /admin/meetups */
    public function index(): ResponseInterface
    {
        $page = (new MeetupService())->list([
            'q'      => trim((string) $this->request->getGet('q')),
            'region' => $this->request->getGet('region'),
            'status' => $this->request->getGet('status'),
            'sort'   => $this->request->getGet('sort'),
            'limit'  => $this->request->getGet('limit') ?? 20,
            'offset' => $this->request->getGet('offset') ?? 0,
        ]);

        // Ersteller in **einer** Abfrage je Seite nachladen, nicht je Zeile.
        $creators = (new UserLookup())->cardsFor(array_map(
            static fn (array $row): int => (int) $row['creator_user_id'],
            $page['items']
        ));

        $presenter = new AdminPresenter();
        $items     = array_map(
            static fn (array $row): array => $presenter->meetupRow($row, $creators[(int) $row['creator_user_id']] ?? null),
            $page['items']
        );

        return $this->respondData($items, 200, [
            'total'  => $page['total'],
            'limit'  => $page['limit'],
            'offset' => $page['offset'],
            'sort'   => $page['sort'],
        ]);
    }
}
