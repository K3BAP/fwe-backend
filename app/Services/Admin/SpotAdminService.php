<?php

namespace App\Services\Admin;

use App\Exceptions\ApiException;
use App\Models\SpotModel;
use CodeIgniter\Database\BaseBuilder;

/**
 * Pflege der kuratierten Startplätze (ADR-019). Löst ein, was ADR-012/A4 bereits vorsah — „nur
 * Admin/Seed pflegen die `spots`-Liste" —; das dortige „kein `POST /spots`" betrifft die *öffentliche*
 * Route, bis jetzt hieß „Admin" schlicht phpMyAdmin von Hand.
 *
 * **Löschen ist ein Hard-Delete und das ist sicher:** `meetups.spot_id` ist `ON DELETE SET NULL`, und
 * `spot_name`/`region`/`lat`/`lng` liegen als Schnappschuss auf der Treffen-Zeile. Ein gelöschter Spot
 * lässt Ortsangabe, Karte und Wetter (ADR-017 liest lat/lng vom Treffen) unangetastet — er kappt nur
 * die Verknüpfung. Deshalb kein Soft-Delete und kein `409 spot_in_use`, sondern `meetups_count` im UI.
 */
final class SpotAdminService
{
    private const COUNT_SUBQUERY = '(SELECT COUNT(*) FROM meetups m WHERE m.spot_id = s.id)';

    /** @var array<string, string> sort-Param → "spalte richtung" */
    private const SORTS = [
        'name_asc'        => 's.name ASC',
        'region_asc'      => 's.region ASC',
        'created_at_desc' => 's.created_at DESC',
    ];

    /**
     * @param array<string, mixed> $f q, region, type, sort, limit, offset
     * @return array{items: list<array<string, mixed>>, total: int, limit: int, offset: int, sort: string}
     */
    public function list(array $f): array
    {
        $db     = db_connect();
        $limit  = max(1, min(200, (int) ($f['limit'] ?? 20)));
        $offset = max(0, (int) ($f['offset'] ?? 0));
        $sort   = isset($f['sort'], self::SORTS[$f['sort']]) ? (string) $f['sort'] : 'name_asc';

        $data = $db->table('spots s')
            ->select('s.*', false)
            ->select(self::COUNT_SUBQUERY . ' AS meetups_count', false);
        $this->applyFilters($data, $f);
        $items = $data->orderBy(self::SORTS[$sort], '', false)->orderBy('s.id', 'ASC')
            ->limit($limit, $offset)->get()->getResultArray();

        $countB = $db->table('spots s')->select('COUNT(*) AS total', false);
        $this->applyFilters($countB, $f);
        $total = (int) ($countB->get()->getRowArray()['total'] ?? 0);

        return ['items' => $items, 'total' => $total, 'limit' => $limit, 'offset' => $offset, 'sort' => $sort];
    }

    /** @return array<string, mixed>|null */
    public function findRow(int $id): ?array
    {
        return db_connect()->table('spots s')
            ->select('s.*', false)
            ->select(self::COUNT_SUBQUERY . ' AS meetups_count', false)
            ->where('s.id', $id)
            ->get()->getRowArray();
    }

    /** @param array<string, mixed> $input */
    public function create(array $input): int
    {
        return (int) model(SpotModel::class)->insert($this->toRow($input), true);
    }

    /**
     * @param array<string, mixed> $input
     * @throws ApiException not_found
     */
    public function update(int $id, array $input): void
    {
        $this->assertExists($id);
        // Nur mitgeschickte Felder ändern (PATCH-Semantik) — `toRow` liefert bereits nur diese.
        model(SpotModel::class)->update($id, $this->toRow($input));
    }

    /** @throws ApiException not_found */
    public function delete(int $id): void
    {
        $this->assertExists($id);
        model(SpotModel::class)->delete($id);
    }

    /**
     * Wire-Eingabe → DB-Zeile. Nur vorhandene Schlüssel, damit PATCH nichts leert.
     *
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    private function toRow(array $input): array
    {
        $row = [];
        foreach (['name', 'region', 'lat', 'lng', 'type'] as $key) {
            if (array_key_exists($key, $input)) {
                $row[$key] = $input[$key];
            }
        }
        if (array_key_exists('description', $input)) {
            $row['description'] = ($input['description'] === '') ? null : $input['description'];
        }
        if (! empty($input['country'])) {
            $row['country'] = strtoupper((string) $input['country']);
        }

        return $row;
    }

    /** @param array<string, mixed> $f */
    private function applyFilters(BaseBuilder $b, array $f): void
    {
        if (! empty($f['q'])) {
            $q = (string) $f['q'];
            $b->groupStart()->like('s.name', $q)->orLike('s.region', $q)->groupEnd();
        }
        if (! empty($f['region'])) {
            $b->where('s.region', $f['region']);
        }
        if (in_array($f['type'] ?? null, ['launch', 'landing', 'area'], true)) {
            $b->where('s.type', $f['type']);
        }
    }

    /** @throws ApiException not_found */
    private function assertExists(int $id): void
    {
        if (db_connect()->table('spots')->where('id', $id)->countAllResults() === 0) {
            throw ApiException::notFound('Startplatz nicht gefunden.');
        }
    }
}
