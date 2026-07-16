<?php

namespace App\Controllers\Api\V1;

use App\Controllers\Api\BaseApiController;
use App\Models\SpotModel;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Startplätze (öffentlich, read-only — ADR-007/012-A4). Quelle für Leaflet-Marker, Treffen-Wizard
 * und die client-seitig abgeleiteten Region-Optionen. Kein Schreiben im MVP (kein `POST /spots`).
 */
final class SpotController extends BaseApiController
{
    public function index(): ResponseInterface
    {
        $spots  = model(SpotModel::class);
        $q      = trim((string) $this->request->getGet('q'));
        $region = trim((string) $this->request->getGet('region'));
        $type   = $this->request->getGet('type');
        $limit  = max(1, min(200, (int) ($this->request->getGet('limit') ?: 200)));
        $offset = max(0, (int) $this->request->getGet('offset'));

        if ($q !== '') {
            $spots->groupStart()->like('name', $q)->orLike('region', $q)->groupEnd();
        }
        if ($region !== '') {
            $spots->where('region', $region);
        }
        if (in_array($type, ['launch', 'landing', 'area'], true)) {
            $spots->where('type', $type);
        }

        $rows = $spots->orderBy('name', 'ASC')->findAll($limit, $offset);

        return $this->respondData(array_map(fn (array $s): array => $this->shape($s), $rows));
    }

    public function show($id): ResponseInterface
    {
        $spot = model(SpotModel::class)->find((int) $id);
        if ($spot === null) {
            return $this->respondError('not_found', 'Startplatz nicht gefunden.', 404);
        }

        return $this->respondData($this->shape($spot, true));
    }

    /**
     * @param array<string, mixed> $s
     * @return array<string, mixed>
     */
    private function shape(array $s, bool $withDescription = false): array
    {
        $out = [
            'id'      => (int) $s['id'],
            'name'    => $s['name'],
            'region'  => $s['region'],
            'country' => $s['country'],
            'lat'     => (float) $s['lat'],
            'lng'     => (float) $s['lng'],
            'type'    => $s['type'],
        ];
        if ($withDescription) {
            $out['description'] = $s['description'] ?? null;
        }

        return $out;
    }
}
