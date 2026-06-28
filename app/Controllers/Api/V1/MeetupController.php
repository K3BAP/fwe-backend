<?php

namespace App\Controllers\Api\V1;

use App\Controllers\Api\BaseApiController;
use App\Exceptions\ApiException;
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

        return $this->respondDetail((int) $id);
    }

    /** POST /meetups — Erstellen (Wizard, §9). Auth-pflichtig; Creator wird Ersteller + Teilnehmer. */
    public function store(): ResponseInterface
    {
        $input = $this->request->getJSON(true) ?? [];
        $rules = [
            'title'            => 'required|string|min_length[3]|max_length[150]',
            'spot_id'          => 'required|is_natural_no_zero',
            'starts_at'        => 'required|string',
            'experience_level' => 'required|in_list[beginner,advanced,expert,all]',
            'max_participants' => 'permit_empty|is_natural_no_zero',
            'description'      => 'permit_empty|string|max_length[5000]',
        ];
        if (! $this->validateData($input, $rules, $this->validationMessages())) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, $this->validator->getErrors());
        }

        try {
            $id = (new MeetupService())->create($this->currentUserId(), $input);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondDetail($id, 201);
    }

    /** PATCH /meetups/{id} — Bearbeiten oder Absagen (§10). BOLA: Creator/Admin. */
    public function update($id): ResponseInterface
    {
        $input = $this->request->getJSON(true) ?? [];
        $rules = [
            'title'            => 'permit_empty|string|min_length[3]|max_length[150]',
            'spot_id'          => 'permit_empty|is_natural_no_zero',
            'starts_at'        => 'permit_empty|string',
            'experience_level' => 'permit_empty|in_list[beginner,advanced,expert,all]',
            'max_participants' => 'permit_empty|is_natural_no_zero',
            'status'           => 'permit_empty|in_list[open,cancelled]',
            'description'      => 'permit_empty|string|max_length[5000]',
        ];
        if (! $this->validateData($input, $rules, $this->validationMessages())) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, $this->validator->getErrors());
        }

        try {
            (new MeetupService())->update((int) $id, $this->currentUserId(), $this->isAdmin(), $input);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondDetail((int) $id);
    }

    /** DELETE /meetups/{id} — Hard-Delete (§10). BOLA: Creator/Admin. */
    public function destroy($id): ResponseInterface
    {
        try {
            (new MeetupService())->delete((int) $id, $this->currentUserId(), $this->isAdmin());
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondNoContent();
    }

    /** Lädt das Treffen frisch und gibt die volle Detail-Projektion zurück (Create/Update/Teilnahme). */
    protected function respondDetail(int $id, int $status = 200): ResponseInterface
    {
        $service      = new MeetupService();
        $row          = $service->findRow($id);
        $participants = $service->participantsOf($id, (int) $row['creator_user_id']);
        $detail       = (new MeetupPresenter())->detail($row, $participants, $this->currentUserId(), $this->isAdmin());

        return $this->respondData($detail, $status);
    }

    /** Shield-Group `admin` (für `can_edit`/BOLA-Override). Für Gäste `false`. */
    protected function isAdmin(): bool
    {
        return auth()->loggedIn() && auth()->user()->inGroup('admin');
    }

    /**
     * Deutsche Validierungsmeldungen (spiegelt das Zod-Schema, §9.2).
     *
     * @return array<string, array<string, string>>
     */
    private function validationMessages(): array
    {
        return [
            'title'            => ['required' => 'Bitte gib einen Titel an.', 'min_length' => 'Titel muss mindestens 3 Zeichen lang sein.', 'max_length' => 'Titel darf höchstens 150 Zeichen lang sein.'],
            'spot_id'          => ['required' => 'Bitte einen Startplatz wählen.', 'is_natural_no_zero' => 'Bitte einen Startplatz wählen.'],
            'starts_at'        => ['required' => 'Bitte Datum und Uhrzeit angeben.'],
            'experience_level' => ['required' => 'Bitte ein Level wählen.', 'in_list' => 'Ungültiges Level.'],
            'max_participants' => ['is_natural_no_zero' => 'Mindestens 1 Teilnehmer.'],
            'description'      => ['max_length' => 'Beschreibung ist zu lang (max. 5000 Zeichen).'],
            'status'           => ['in_list' => 'Ungültiger Status.'],
        ];
    }
}
