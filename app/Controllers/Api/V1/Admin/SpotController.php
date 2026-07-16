<?php

namespace App\Controllers\Api\V1\Admin;

use App\Controllers\Api\BaseApiController;
use App\Exceptions\ApiException;
use App\Services\Admin\AdminPresenter;
use App\Services\Admin\SpotAdminService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Pflege der kuratierten Startplätze (ADR-019 / ADR-012/A4). Die Regeln spiegeln das Zod-Schema
 * `adminSpotInputSchema` im Frontend.
 */
final class SpotController extends BaseApiController
{
    /** GET /admin/spots */
    public function index(): ResponseInterface
    {
        $page = (new SpotAdminService())->list([
            'q'      => trim((string) $this->request->getGet('q')),
            'region' => $this->request->getGet('region'),
            'type'   => $this->request->getGet('type'),
            'sort'   => $this->request->getGet('sort'),
            'limit'  => $this->request->getGet('limit') ?? 20,
            'offset' => $this->request->getGet('offset') ?? 0,
        ]);

        $presenter = new AdminPresenter();
        $items     = array_map(static fn (array $row): array => $presenter->spot($row), $page['items']);

        return $this->respondData($items, 200, [
            'total'  => $page['total'],
            'limit'  => $page['limit'],
            'offset' => $page['offset'],
            'sort'   => $page['sort'],
        ]);
    }

    /** POST /admin/spots */
    public function store(): ResponseInterface
    {
        $input = $this->request->getJSON(true) ?? [];
        if (! $this->validateData($input, $this->rules(), $this->messages())) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, $this->validator->getErrors());
        }

        $id = (new SpotAdminService())->create($input);

        return $this->respondSpot($id, 201);
    }

    /** PATCH /admin/spots/{id} */
    public function update(int $id): ResponseInterface
    {
        $input = $this->request->getJSON(true) ?? [];
        if (! $this->validateData($input, $this->rules(true), $this->messages())) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, $this->validator->getErrors());
        }

        try {
            (new SpotAdminService())->update($id, $input);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondSpot($id);
    }

    /**
     * DELETE /admin/spots/{id} — Hard-Delete. Unbedenklich: der FK ist `ON DELETE SET NULL` und die
     * Treffen tragen Ort/Koordinaten als Schnappschuss, verlieren also nur die Verknüpfung.
     */
    public function destroy(int $id): ResponseInterface
    {
        try {
            (new SpotAdminService())->delete($id);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondNoContent();
    }

    /**
     * @return array<string, string>
     */
    private function rules(bool $patch = false): array
    {
        $required = $patch ? 'permit_empty' : 'required';

        return [
            'name'        => $required . '|string|min_length[2]|max_length[150]',
            'region'      => $required . '|string|max_length[80]',
            'country'     => 'permit_empty|exact_length[2]|alpha',
            'lat'         => $required . '|decimal|greater_than_equal_to[-90]|less_than_equal_to[90]',
            'lng'         => $required . '|decimal|greater_than_equal_to[-180]|less_than_equal_to[180]',
            'type'        => $required . '|in_list[launch,landing,area]',
            'description' => 'permit_empty|string|max_length[2000]',
        ];
    }

    /**
     * @return array<string, array<string, string>>
     */
    private function messages(): array
    {
        return [
            'name'    => ['required' => 'Bitte einen Namen angeben.', 'min_length' => 'Mindestens 2 Zeichen.', 'max_length' => 'Höchstens 150 Zeichen.'],
            'region'  => ['required' => 'Bitte eine Region angeben.', 'max_length' => 'Höchstens 80 Zeichen.'],
            'country' => ['exact_length' => 'Bitte den 2-stelligen Ländercode angeben (z. B. DE).', 'alpha' => 'Nur Buchstaben.'],
            'lat'     => ['required' => 'Bitte den Breitengrad angeben.', 'decimal' => 'Bitte eine Dezimalzahl angeben.', 'greater_than_equal_to' => 'Muss zwischen -90 und 90 liegen.', 'less_than_equal_to' => 'Muss zwischen -90 und 90 liegen.'],
            'lng'     => ['required' => 'Bitte den Längengrad angeben.', 'decimal' => 'Bitte eine Dezimalzahl angeben.', 'greater_than_equal_to' => 'Muss zwischen -180 und 180 liegen.', 'less_than_equal_to' => 'Muss zwischen -180 und 180 liegen.'],
            'type'    => ['required' => 'Bitte einen Typ wählen.', 'in_list' => 'Ungültiger Typ.'],
            'description' => ['max_length' => 'Höchstens 2000 Zeichen.'],
        ];
    }

    private function respondSpot(int $id, int $status = 200): ResponseInterface
    {
        $row = (new SpotAdminService())->findRow($id);
        if ($row === null) {
            return $this->respondError('not_found', 'Startplatz nicht gefunden.', 404);
        }

        return $this->respondData((new AdminPresenter())->spot($row), $status);
    }
}
