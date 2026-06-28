<?php

namespace App\Services;

use CodeIgniter\Database\BaseBuilder;
use CodeIgniter\Database\RawSql;

/**
 * Datenzugriff + Geschäftslogik der Flugtreffen-Domäne (ADR-013: Controller bleibt dünn).
 * In M3-Slice 2 nur lesend (Liste/Detail). Schreiben (Create/Update/Delete) und Teilnahme
 * (Join/Leave) folgen in Slice 3/4.
 *
 * Der `participant_count` wird als **korrelierte Subquery** mitgeladen (keine GROUP-BY-Verzerrung),
 * sämtliche Filter — auch die auf dem **abgeleiteten** Status — laufen in WHERE (nicht HAVING, das
 * würde den Count brechen). `meta.total` kommt aus einem **parallelen Count-Builder** mit denselben
 * Bedingungen. Zeitvergleiche konsequent in UTC (`UTC_TIMESTAMP()` ⇔ `gmdate()` im Presenter).
 */
final class MeetupService
{
    /** Korrelierte Teilnehmerzahl je Treffen (für SELECT + Kapazitätsfilter). */
    private const COUNT_SUBQUERY = '(SELECT COUNT(*) FROM meetup_participants mp WHERE mp.meetup_id = m.id)';

    /** @var array<string, string> sort-Param → "spalte richtung" */
    private const SORTS = [
        'starts_at_asc'   => 'm.starts_at ASC',
        'starts_at_desc'  => 'm.starts_at DESC',
        'created_at_desc' => 'm.created_at DESC',
        'participants_desc' => 'participant_count DESC',
        'title_asc'       => 'm.title ASC',
    ];

    /**
     * Gefilterte/sortierte/paginierte Liste (02-flugtreffen.md §6).
     *
     * @param array<string, mixed> $f
     * @return array{items: list<array<string, mixed>>, total: int, limit: int, offset: int, sort: string}
     */
    public function list(array $f): array
    {
        $db     = db_connect();
        $limit  = max(1, min(200, (int) ($f['limit'] ?? 20)));
        $offset = max(0, (int) ($f['offset'] ?? 0));
        $sort   = isset($f['sort'], self::SORTS[$f['sort']]) ? (string) $f['sort'] : 'starts_at_asc';

        $data = $db->table('meetups m')
            ->select('m.*', false)
            ->select(self::COUNT_SUBQUERY . ' AS participant_count', false);
        $this->applyFilters($data, $f);
        $data->orderBy(self::SORTS[$sort], '', false)->orderBy('m.id', 'ASC');
        $items = $data->limit($limit, $offset)->get()->getResultArray();

        $countB = $db->table('meetups m')->select('COUNT(*) AS total', false);
        $this->applyFilters($countB, $f);
        $total = (int) ($countB->get()->getRowArray()['total'] ?? 0);

        return ['items' => $items, 'total' => $total, 'limit' => $limit, 'offset' => $offset, 'sort' => $sort];
    }

    /**
     * Einzelnes Treffen inkl. `participant_count` (oder `null`, wenn nicht vorhanden).
     *
     * @return array<string, mixed>|null
     */
    public function findRow(int $id): ?array
    {
        return db_connect()->table('meetups m')
            ->select('m.*', false)
            ->select(self::COUNT_SUBQUERY . ' AS participant_count', false)
            ->where('m.id', $id)
            ->get()->getRowArray();
    }

    /**
     * Teilnehmer eines Treffens als `profiles`-Join, **Ersteller zuerst**, dann `joined_at` aufsteigend.
     *
     * @return list<array<string, mixed>>
     */
    public function participantsOf(int $meetupId, int $creatorId): array
    {
        return db_connect()->table('meetup_participants mp')
            ->select('p.user_id, p.display_name, p.handle, p.avatar_path', false)
            ->join('profiles p', 'p.user_id = mp.user_id')
            ->where('mp.meetup_id', $meetupId)
            ->orderBy('mp.user_id = ' . $creatorId, 'DESC', false)
            ->orderBy('mp.joined_at', 'ASC')
            ->get()->getResultArray();
    }

    /**
     * Wendet Such-/Filter-Bedingungen (§6.1/§6.2) auf einen Builder an — identisch für Daten- und
     * Count-Builder, damit `meta.total` exakt zur Liste passt.
     *
     * @param array<string, mixed> $f
     */
    private function applyFilters(BaseBuilder $b, array $f): void
    {
        $count = self::COUNT_SUBQUERY;

        if (! empty($f['q'])) {
            $q = (string) $f['q'];
            $b->groupStart()
                ->like('m.title', $q)
                ->orLike('m.spot_name', $q)
                ->orLike('m.region', $q)
                ->orLike('m.description', $q)
                ->groupEnd();
        }
        if (! empty($f['region'])) {
            $b->where('m.region', $f['region']);
        }
        if (in_array($f['level'] ?? null, ['beginner', 'advanced', 'expert'], true)) {
            $b->whereIn('m.experience_level', [$f['level'], 'all']); // 'all'/leer ⇒ kein Filter
        }
        if (! empty($f['date_from'])) {
            $b->where('m.starts_at >=', $f['date_from'] . ' 00:00:00');
        }
        if (! empty($f['date_to'])) {
            $b->where('m.starts_at <=', $f['date_to'] . ' 23:59:59');
        }

        $status = $f['status'] ?? null;
        if ($status === 'cancelled') {
            $b->where('m.status', 'cancelled');
        } elseif ($status === 'finished') {
            $b->where('m.status', 'open')->where(new RawSql('m.starts_at < UTC_TIMESTAMP()'));
        } elseif ($status === 'full') {
            $b->where('m.status', 'open')
                ->where(new RawSql('m.starts_at >= UTC_TIMESTAMP()'))
                ->where(new RawSql('m.max_participants IS NOT NULL'))
                ->where(new RawSql("{$count} >= m.max_participants"));
        } elseif ($status === 'open') {
            $this->whereJoinable($b);
        }

        if (! empty($f['has_free_spots'])) {
            $this->whereJoinable($b);
        }
    }

    /** „beitretbar/offen": nicht abgesagt, in der Zukunft, und noch Plätze frei (NULL = unbegrenzt). */
    private function whereJoinable(BaseBuilder $b): void
    {
        $count = self::COUNT_SUBQUERY;
        $b->where('m.status', 'open')
            ->where(new RawSql('m.starts_at >= UTC_TIMESTAMP()'))
            ->groupStart()
                ->where(new RawSql('m.max_participants IS NULL'))
                ->orWhere(new RawSql("{$count} < m.max_participants"))
            ->groupEnd();
    }
}
