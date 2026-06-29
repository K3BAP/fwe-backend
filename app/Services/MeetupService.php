<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\MeetupModel;
use App\Models\MeetupParticipantModel;
use App\Models\SpotModel;
use CodeIgniter\Database\BaseBuilder;
use CodeIgniter\Database\RawSql;
use DateTimeImmutable;
use DateTimeZone;
use Throwable;

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

    // ───────────────────────── Schreiben (Slice 3) ─────────────────────────

    /**
     * Legt ein Treffen an (02-flugtreffen.md §9.3): Spot-Geo als Snapshot kopieren, `INSERT meetups`
     * (`status=open`, `visibility=public`) und Ersteller als ersten Teilnehmer — in **einer**
     * Transaktion. Server leitet `spot_name/region/lat/lng` aus `spot_id` ab (Client-Werte ignoriert).
     *
     * @param array<string, mixed> $input
     * @throws ApiException validation_error (Zukunftsdatum/ungültiger Spot) | internal_error
     */
    public function create(int $creatorId, array $input): int
    {
        $startsAt = $this->normalizeStartsAt((string) ($input['starts_at'] ?? ''));
        $snapshot = $this->spotSnapshot((int) ($input['spot_id'] ?? 0));

        $db = db_connect();
        $db->transBegin();
        try {
            $id = (int) model(MeetupModel::class)->insert(array_merge($snapshot, [
                'creator_user_id'  => $creatorId,
                'title'            => $input['title'],
                'description'      => $this->emptyToNull($input['description'] ?? null),
                'starts_at'        => $startsAt,
                'experience_level' => $input['experience_level'],
                'max_participants' => $this->normalizeMax($input['max_participants'] ?? null),
                'status'           => 'open',
                'visibility'       => 'public',
            ]), true);

            model(MeetupParticipantModel::class)->insert(['meetup_id' => $id, 'user_id' => $creatorId]);

            $db->transCommit();

            return $id;
        } catch (Throwable $e) {
            $db->transRollback();
            if ($e instanceof ApiException) {
                throw $e;
            }
            log_message('error', 'Meetup create failed: ' . $e->getMessage());
            throw new ApiException('internal_error', 'Treffen konnte nicht erstellt werden.', 500);
        }
    }

    /**
     * Bearbeiten/Absagen (§10). BOLA: nur Creator oder Admin. Nur **vorhandene** Felder werden
     * geändert; `spot_id`-Wechsel re-derived die Geo-Felder; `max_participants` darf nicht unter die
     * aktuelle Teilnehmerzahl; Absagen via `status='cancelled'`.
     *
     * @param array<string, mixed> $input
     * @throws ApiException not_found | forbidden | validation_error | capacity_below_current
     */
    public function update(int $id, int $userId, bool $isAdmin, array $input): void
    {
        $row = $this->findRow($id);
        if ($row === null) {
            throw ApiException::notFound('Flugtreffen nicht gefunden.');
        }
        $this->assertCanManage($row, $userId, $isAdmin, 'Nur der Organisator darf das Treffen bearbeiten.');

        $data = [];
        if (array_key_exists('title', $input)) {
            $data['title'] = $input['title'];
        }
        if (array_key_exists('description', $input)) {
            $data['description'] = $this->emptyToNull($input['description']);
        }
        if (array_key_exists('experience_level', $input)) {
            $data['experience_level'] = $input['experience_level'];
        }
        if (isset($input['starts_at']) && $input['starts_at'] !== '') {
            $data['starts_at'] = $this->normalizeStartsAt((string) $input['starts_at']);
        }
        if (isset($input['spot_id']) && $input['spot_id'] !== '') {
            $data = array_merge($data, $this->spotSnapshot((int) $input['spot_id']));
        }
        if (array_key_exists('max_participants', $input)) {
            $max = $this->normalizeMax($input['max_participants']);
            if ($max !== null && $max < (int) $row['participant_count']) {
                throw ApiException::conflict('capacity_below_current', 'Die Kapazität darf nicht unter die aktuelle Teilnehmerzahl gesenkt werden.');
            }
            $data['max_participants'] = $max;
        }
        if (array_key_exists('status', $input) && in_array($input['status'], ['open', 'cancelled'], true)) {
            $data['status'] = $input['status'];
        }

        if ($data !== []) {
            model(MeetupModel::class)->update($id, $data);
        }

        // Absage → alle Teilnehmer (außer dem Auslöser) benachrichtigen (best-effort).
        if (($data['status'] ?? null) === 'cancelled' && $row['status'] !== 'cancelled') {
            $notifier = new NotificationService();
            foreach ($this->participantIds($id) as $participantId) {
                if ($participantId !== $userId) {
                    $notifier->create($participantId, 'meetup_cancelled', $userId, 'meetup', $id, ['meetup_title' => $row['title']]);
                }
            }
        }
    }

    /**
     * Hard-Delete (§10). BOLA: nur Creator oder Admin. Teilnehmer verschwinden via FK `ON DELETE CASCADE`.
     *
     * @throws ApiException not_found | forbidden
     */
    public function delete(int $id, int $userId, bool $isAdmin): void
    {
        $row = $this->findRow($id);
        if ($row === null) {
            throw ApiException::notFound('Flugtreffen nicht gefunden.');
        }
        $this->assertCanManage($row, $userId, $isAdmin, 'Nur der Organisator darf das Treffen löschen.');

        model(MeetupModel::class)->delete($id);
    }

    // ─────────────────────── Teilnahme (Slice 4) ───────────────────────

    /**
     * Beitreten (§8.1) — nebenläufigkeitssicher in einer Transaktion. Die `FOR UPDATE`-Sperre auf der
     * Meetup-Zeile serialisiert konkurrierende Beitritte auf den letzten Platz; `UNIQUE(meetup_id,
     * user_id)` ist der Backstop. **Idempotent**: bereits Teilnehmer ⇒ kein Fehler.
     *
     * @throws ApiException not_found | meetup_not_joinable | meetup_full | internal_error
     */
    public function join(int $id, int $userId): void
    {
        $db = db_connect();
        $db->transBegin();

        $row = $db->query('SELECT status, starts_at, max_participants FROM meetups WHERE id = ? FOR UPDATE', [$id])->getRowArray();
        if ($row === null) {
            $db->transRollback();
            throw ApiException::notFound('Flugtreffen nicht gefunden.');
        }
        if ($row['status'] === 'cancelled' || (string) $row['starts_at'] < gmdate('Y-m-d H:i:s')) {
            $db->transRollback();
            throw ApiException::conflict('meetup_not_joinable', 'Beitritt nicht mehr möglich.');
        }

        // Bereits Teilnehmer? ⇒ idempotent (innerhalb der Sperre geprüft).
        if ($db->query('SELECT id FROM meetup_participants WHERE meetup_id = ? AND user_id = ?', [$id, $userId])->getRowArray() !== null) {
            $db->transCommit();

            return;
        }

        $count = (int) ($db->query('SELECT COUNT(*) AS c FROM meetup_participants WHERE meetup_id = ?', [$id])->getRowArray()['c'] ?? 0);
        if ($row['max_participants'] !== null && $count >= (int) $row['max_participants']) {
            $db->transRollback();
            throw ApiException::conflict('meetup_full', 'Dieses Treffen ist leider ausgebucht.');
        }

        try {
            $db->query('INSERT INTO meetup_participants (meetup_id, user_id) VALUES (?, ?)', [$id, $userId]);
        } catch (Throwable $e) {
            // UNIQUE-Race (zeitgleicher Beitritt): existiert die Zeile nun ⇒ idempotent, sonst echter Fehler.
            if ($db->query('SELECT id FROM meetup_participants WHERE meetup_id = ? AND user_id = ?', [$id, $userId])->getRowArray() === null) {
                $db->transRollback();
                log_message('error', 'Meetup join insert failed: ' . $e->getMessage());
                throw new ApiException('internal_error', 'Beitritt fehlgeschlagen.', 500);
            }
        }

        $db->transCommit();

        // Organisator über neuen Teilnehmer informieren (best-effort, nach dem Commit).
        $meetup = model(MeetupModel::class)->find($id);
        if ($meetup !== null && (int) $meetup['creator_user_id'] !== $userId) {
            (new NotificationService())->create((int) $meetup['creator_user_id'], 'meetup_join', $userId, 'meetup', $id, ['meetup_title' => $meetup['title']]);
        }
    }

    /**
     * Selbst-Austritt (§8.2). **Idempotent** (kein Fehler, wenn nicht angemeldet). Der Ersteller kann
     * nicht austreten (belegt den Organisator-Slot).
     *
     * @throws ApiException not_found | creator_cannot_leave
     */
    public function leave(int $id, int $userId): void
    {
        $row = $this->findRow($id);
        if ($row === null) {
            throw ApiException::notFound('Flugtreffen nicht gefunden.');
        }
        if ((int) $row['creator_user_id'] === $userId) {
            throw ApiException::conflict('creator_cannot_leave', 'Als Organisator kannst du nicht austreten — sage das Treffen ab oder lösche es.');
        }

        model(MeetupParticipantModel::class)->where('meetup_id', $id)->where('user_id', $userId)->delete();
    }

    /**
     * Teilnehmer entfernen (§8.3). BOLA: Creator oder Admin. Der Ersteller kann nicht entfernt werden.
     *
     * @throws ApiException not_found | forbidden | creator_cannot_leave
     */
    public function removeParticipant(int $id, int $actorId, bool $isAdmin, int $targetUserId): void
    {
        $row = $this->findRow($id);
        if ($row === null) {
            throw ApiException::notFound('Flugtreffen nicht gefunden.');
        }
        $this->assertCanManage($row, $actorId, $isAdmin, 'Nur der Organisator darf Teilnehmer entfernen.');
        if ((int) $row['creator_user_id'] === $targetUserId) {
            throw ApiException::conflict('creator_cannot_leave', 'Der Organisator kann nicht entfernt werden.');
        }

        model(MeetupParticipantModel::class)->where('meetup_id', $id)->where('user_id', $targetUserId)->delete();
    }

    /**
     * BOLA-Check (Querschnitt): Creator oder Admin, sonst `403`.
     *
     * @param array<string, mixed> $row
     */
    private function assertCanManage(array $row, int $userId, bool $isAdmin, string $message): void
    {
        if ((int) $row['creator_user_id'] !== $userId && ! $isAdmin) {
            throw ApiException::forbidden($message);
        }
    }

    /**
     * Teilnehmer-IDs eines Treffens (für Benachrichtigungen).
     *
     * @return list<int>
     */
    private function participantIds(int $meetupId): array
    {
        return array_map(
            static fn (array $r): int => (int) $r['user_id'],
            db_connect()->table('meetup_participants')->select('user_id')->where('meetup_id', $meetupId)->get()->getResultArray(),
        );
    }

    /** ISO-Eingabe → UTC-DATETIME (`Y-m-d H:i:s`); wirft bei ungültigem/vergangenem Datum `422`. */
    private function normalizeStartsAt(string $iso): string
    {
        $iso = trim($iso);
        try {
            $dt = new DateTimeImmutable($iso);
        } catch (Throwable) {
            throw ApiException::validation(['starts_at' => 'Ungültiges Datum.']);
        }
        $utc = $dt->setTimezone(new DateTimeZone('UTC'));
        if ($utc <= new DateTimeImmutable('now', new DateTimeZone('UTC'))) {
            throw ApiException::validation(['starts_at' => 'Der Termin muss in der Zukunft liegen.']);
        }

        return $utc->format('Y-m-d H:i:s');
    }

    /**
     * Geo-Snapshot aus `spot_id` (Vertrauensgrenze: Client-Geo wird ignoriert).
     *
     * @return array{spot_id:int, spot_name:string, region:string, lat:mixed, lng:mixed}
     * @throws ApiException validation_error (fields.spot_id)
     */
    private function spotSnapshot(int $spotId): array
    {
        $spot = model(SpotModel::class)->find($spotId);
        if ($spot === null) {
            throw ApiException::validation(['spot_id' => 'Bitte einen gültigen Startplatz wählen.']);
        }

        return [
            'spot_id'   => (int) $spot['id'],
            'spot_name' => $spot['name'],
            'region'    => $spot['region'],
            'lat'       => $spot['lat'],
            'lng'       => $spot['lng'],
        ];
    }

    /** Leeren String/`null` → `null` (= unbegrenzt), sonst Ganzzahl. */
    private function normalizeMax(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (int) $value;
    }

    private function emptyToNull(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }
}
