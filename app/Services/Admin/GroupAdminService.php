<?php

namespace App\Services\Admin;

use App\Exceptions\ApiException;
use App\Models\GroupModel;
use CodeIgniter\Database\BaseBuilder;
use Throwable;

/**
 * Gruppen-Sicht des Admin-Bereichs (ADR-019).
 *
 * Bewusst **neben** {@see \App\Services\GroupService::list()} statt darin: jene Methode ist eine
 * *Sichtbarkeits*-Abfrage (öffentlich oder eigene Mitgliedschaft, ohne gelöschte). Ein `$isAdmin`, das
 * dort sowohl den Sichtbarkeits- als auch den Soft-Delete-Filter aushebelt, wäre kein BOLA-Override
 * mehr, sondern eine andere Abfrage unter demselben Namen — und würde genau das Muster verwässern, das
 * die bestehenden `$isAdmin`-Parameter (allesamt Autorisierung auf *Schreib*-Pfaden) ausmacht.
 * Außerdem braucht die Admin-Tabelle ohnehin anderes: Pagination, Sortierung, Owner, `deleted_at`.
 */
final class GroupAdminService
{
    /** @var array<string, string> sort-Param → "spalte richtung" */
    private const SORTS = [
        'created_at_desc' => 'g.created_at DESC',
        'name_asc'        => 'g.name ASC',
        'members_desc'    => 'g.members_count DESC',
    ];

    /**
     * Alle Gruppen — **ohne** Sichtbarkeits- und **ohne** Soft-Delete-Filter. Genau das ist der Zweck.
     *
     * @param array<string, mixed> $f q, visibility, status(active|deleted), sort, limit, offset
     * @return array{items: list<array<string, mixed>>, total: int, limit: int, offset: int, sort: string}
     */
    public function list(array $f): array
    {
        $db     = db_connect();
        $limit  = max(1, min(200, (int) ($f['limit'] ?? 20)));
        $offset = max(0, (int) ($f['offset'] ?? 0));
        $sort   = isset($f['sort'], self::SORTS[$f['sort']]) ? (string) $f['sort'] : 'created_at_desc';

        $data = $db->table('groups g')->select('g.*', false);
        $this->applyFilters($data, $f);
        $items = $data->orderBy(self::SORTS[$sort], '', false)->orderBy('g.id', 'ASC')
            ->limit($limit, $offset)->get()->getResultArray();

        $countB = $db->table('groups g')->select('COUNT(*) AS total', false);
        $this->applyFilters($countB, $f);
        $total = (int) ($countB->get()->getRowArray()['total'] ?? 0);

        return ['items' => $items, 'total' => $total, 'limit' => $limit, 'offset' => $offset, 'sort' => $sort];
    }

    /**
     * Spiegelbild von {@see \App\Services\GroupService::delete()}: hebt den Soft-Delete der Gruppe und
     * ihrer Channels wieder auf. Ohne das wäre die (gewollte) Anzeige gelöschter Gruppen eine Sackgasse.
     *
     * @throws ApiException group_not_found | group_not_deleted
     */
    public function restore(int $id): void
    {
        $group = db_connect()->table('groups')->where('id', $id)->get()->getRowArray();
        if ($group === null) {
            throw new ApiException('group_not_found', 'Gruppe nicht gefunden.', 404);
        }
        if ($group['deleted_at'] === null) {
            throw ApiException::conflict('group_not_deleted', 'Diese Gruppe ist nicht gelöscht.');
        }

        $db = db_connect();
        $db->transBegin();
        try {
            model(GroupModel::class)->update($id, ['deleted_at' => null]);
            $db->table('conversations')
                ->where('context_type', 'group')->where('context_id', $id)
                ->update(['deleted_at' => null]);
            $db->transCommit();
        } catch (Throwable $e) {
            $db->transRollback();
            log_message('error', 'Group restore failed: ' . $e->getMessage());
            throw new ApiException('internal_error', 'Gruppe konnte nicht wiederhergestellt werden.', 500);
        }
    }

    /**
     * Filter für Daten- **und** Count-Builder — identisch, damit `meta.total` exakt zur Liste passt.
     *
     * @param array<string, mixed> $f
     */
    private function applyFilters(BaseBuilder $b, array $f): void
    {
        if (! empty($f['q'])) {
            $q = (string) $f['q'];
            $b->groupStart()->like('g.name', $q)->orLike('g.slug', $q)->groupEnd();
        }
        if (in_array($f['visibility'] ?? null, ['public', 'unlisted', 'private'], true)) {
            $b->where('g.visibility', $f['visibility']);
        }

        // Ohne `status` kein Filter: die Admin-Liste zeigt standardmäßig alles, auch Gelöschtes.
        switch ($f['status'] ?? null) {
            case 'active':
                $b->where('g.deleted_at IS NULL', null, false);
                break;

            case 'deleted':
                $b->where('g.deleted_at IS NOT NULL', null, false);
                break;
        }
    }
}
