<?php

namespace App\Controllers\Api\V1;

use App\Controllers\Api\BaseApiController;
use App\Services\MeetupPresenter;
use App\Services\MeetupService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Flugtreffen (API.md §5, 02-flugtreffen.md). Lesen ist öffentlich (Gäste lesen); Schreiben/Teilnahme
 * (Slice 3/4) hängen am Auth-Filter. Der Controller bleibt dünn: Request → Service → Presenter →
 * Envelope. Geschäftslogik (Filter/Transaktionen) liegt im {@see MeetupService}.
 */
final class MeetupController extends BaseApiController
{
    /** GET /meetups — Liste mit Suche/Filter/Sort/Pagination (§6). */
    public function index(): ResponseInterface
    {
        $result = (new MeetupService())->list([
            'q'              => trim((string) $this->request->getGet('q')),
            'region'         => trim((string) $this->request->getGet('region')),
            'level'          => $this->request->getGet('level'),
            'status'         => $this->request->getGet('status'),
            'date_from'      => $this->request->getGet('date_from'),
            'date_to'        => $this->request->getGet('date_to'),
            'has_free_spots' => $this->request->getGet('has_free_spots'),
            'sort'           => $this->request->getGet('sort'),
            'limit'          => $this->request->getGet('limit'),
            'offset'         => $this->request->getGet('offset'),
        ]);

        $present = new MeetupPresenter();
        $items   = array_map(fn (array $row): array => $present->listItem($row), $result['items']);

        return $this->respondData($items, 200, [
            'total'  => $result['total'],
            'limit'  => $result['limit'],
            'offset' => $result['offset'],
            'sort'   => $result['sort'],
        ]);
    }

    /** GET /meetups/{id} — Detail + Teilnehmer + nutzerbezogene Flags (§7). */
    public function show($id): ResponseInterface
    {
        $service = new MeetupService();
        $row     = $service->findRow((int) $id);
        if ($row === null) {
            return $this->respondError('not_found', 'Flugtreffen nicht gefunden.', 404);
        }

        $participants = $service->participantsOf((int) $id, (int) $row['creator_user_id']);
        $detail       = (new MeetupPresenter())->detail($row, $participants, $this->currentUserId(), $this->isAdmin());

        return $this->respondData($detail);
    }

    /** Shield-Group `admin` (für `can_edit`/BOLA-Override). Für Gäste `false`. */
    protected function isAdmin(): bool
    {
        return auth()->loggedIn() && auth()->user()->inGroup('admin');
    }
}
