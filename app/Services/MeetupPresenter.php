<?php

namespace App\Services;

/**
 * Baut die Flugtreffen-DTOs (API.md §5, 02-flugtreffen.md §7) aus den (bereits mit `participant_count`
 * angereicherten) Tabellenzeilen. **Eine** Stelle für die Projektionen + den abgeleiteten Status, von
 * Read- **und** Write-/Teilnahme-Controllern genutzt. Feldnamen entsprechen exakt dem Wire-Vertrag
 * (Zod-Schemas im Frontend): flach (`spot_id`/`creator_user_id`/`derived_status`), Teilnehmer als
 * `PublicUserCard`, `conversation_id` nullable (in M3 immer `null` — Chat-Domäne ab M5).
 */
final class MeetupPresenter
{
    /**
     * Listen-Projektion (Karte/Tabelle/Cards). Erwartet `participant_count` in der Zeile.
     *
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function listItem(array $row): array
    {
        $count = (int) ($row['participant_count'] ?? 0);
        $max   = $row['max_participants'] !== null ? (int) $row['max_participants'] : null;

        return [
            'id'                => (int) $row['id'],
            'title'             => $row['title'],
            'spot_name'         => $row['spot_name'],
            'region'            => $row['region'],
            'starts_at'         => $this->toIso($row['starts_at']),
            'experience_level'  => $row['experience_level'],
            'participant_count' => $count,
            'max_participants'  => $max,
            'free_spots'        => $max !== null ? max(0, $max - $count) : null,
            'derived_status'    => $this->deriveStatus($row['status'], (string) $row['starts_at'], $max, $count),
            'lat'               => $row['lat'] !== null ? (float) $row['lat'] : null,
            'lng'               => $row['lng'] !== null ? (float) $row['lng'] : null,
        ];
    }

    /**
     * Detail-Projektion: Listenfelder + Beschreibung, Teilnehmer und nutzerbezogene Flags.
     * `participant_count` wird aus den geladenen Teilnehmer-Zeilen abgeleitet (Single Source).
     *
     * @param array<string, mixed>        $row             Meetup-Zeile
     * @param list<array<string, mixed>>  $participantRows profiles-Join (user_id/display_name/handle/avatar_path), Ersteller zuerst
     * @return array<string, mixed>
     */
    public function detail(array $row, array $participantRows, int $viewerId, bool $isAdmin): array
    {
        $cards     = new ProfilePresenter();
        $count     = count($participantRows);
        $max       = $row['max_participants'] !== null ? (int) $row['max_participants'] : null;
        $creatorId = (int) $row['creator_user_id'];

        $participants  = [];
        $isParticipant = false;
        foreach ($participantRows as $p) {
            $participants[] = $cards->publicUserCard($p);
            if ((int) $p['user_id'] === $viewerId) {
                $isParticipant = true;
            }
        }

        return [
            'id'                => (int) $row['id'],
            'title'             => $row['title'],
            'spot_id'           => $row['spot_id'] !== null ? (int) $row['spot_id'] : null,
            'spot_name'         => $row['spot_name'],
            'region'            => $row['region'],
            'lat'               => $row['lat'] !== null ? (float) $row['lat'] : null,
            'lng'               => $row['lng'] !== null ? (float) $row['lng'] : null,
            'starts_at'         => $this->toIso($row['starts_at']),
            'experience_level'  => $row['experience_level'],
            'participant_count' => $count,
            'max_participants'  => $max,
            'free_spots'        => $max !== null ? max(0, $max - $count) : null,
            'derived_status'    => $this->deriveStatus($row['status'], (string) $row['starts_at'], $max, $count),
            'creator_user_id'   => $creatorId,
            'conversation_id'   => null, // Treffen-Chat erst in M5 (keine conversations-Tabelle in M3)
            'description'       => $row['description'],
            'participants'      => $participants,
            'is_participant'    => $viewerId > 0 && $isParticipant,
            'can_edit'          => $viewerId > 0 && ($viewerId === $creatorId || $isAdmin),
        ];
    }

    /**
     * Abgeleiteter Status (02-flugtreffen.md §4) — Präzedenz `cancelled > finished > full > open`.
     * `$startsAtDb` ist eine UTC-DATETIME (`Y-m-d H:i:s`); der lexikografische Vergleich mit `gmdate`
     * ist gleichbedeutend mit dem zeitlichen (gleiche UTC-Basis wie der SQL-Filter via `UTC_TIMESTAMP()`).
     */
    public function deriveStatus(string $status, string $startsAtDb, ?int $max, int $count): string
    {
        if ($status === 'cancelled') {
            return 'cancelled';
        }
        if ($startsAtDb < gmdate('Y-m-d H:i:s')) {
            return 'finished';
        }
        if ($max !== null && $count >= $max) {
            return 'full';
        }

        return 'open';
    }

    /** MySQL-DATETIME → ISO-8601 (UTC; appTimezone = UTC). */
    private function toIso(?string $datetime): ?string
    {
        return $datetime === null ? null : str_replace(' ', 'T', $datetime) . 'Z';
    }
}
