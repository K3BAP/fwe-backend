<?php

namespace App\Services\Admin;

use App\Services\MeetupPresenter;

/**
 * DTO-Projektionen des Admin-Bereichs (ADR-019). Eine Datei, weil das Dashboard **eine**
 * Vertragsfläche ist — vier Dateien mit je einer Methode wären schlechter lesbar, und der
 * GroupPresenter trägt bereits sieben Projektionen.
 *
 * Die Feldnamen hier sind der bindende Wire-Vertrag: die Zod-Schemas unter
 * `frontend/src/api/schemas/admin.ts` spiegeln sie exakt.
 *
 * **Typ-Casts sind nicht kosmetisch:** MySQL liefert `SUM()`/`COUNT()` und `DECIMAL` als *String* und
 * `active` als `0`/`1`. Zods `z.number()`/`z.boolean()` weisen alle drei zurück — die Casts sind das,
 * was den Vertrag überhaupt einhält.
 */
final class AdminPresenter
{
    /**
     * Zeile der Nutzerliste.
     *
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function userRow(array $row): array
    {
        return [
            'id'            => (int) $row['id'],
            // Fällt zurück, statt den Nutzer zu verschlucken: die Profilzeile ist per LEFT JOIN optional.
            'display_name'  => $row['display_name'] ?? '—',
            'handle'        => $row['handle'] ?? null,
            'avatar_path'   => $row['avatar_path'] ?? null,
            'email'         => $row['email'] ?? null,
            'is_admin'      => (bool) $row['is_admin'],
            'active'        => (bool) $row['active'],
            'created_at'    => $this->toIso($row['created_at'] ?? null),
            'last_active'   => $this->toIso($row['last_active'] ?? null),
            'deleted_at'    => $this->toIso($row['deleted_at'] ?? null),
            'meetups_count' => (int) $row['meetups_count'],
            'groups_count'  => (int) $row['groups_count'],
        ];
    }

    /**
     * Nutzer-Detail = Zeile + Profilfelder + `is_self`.
     *
     * `is_self` erlaubt dem UI, die drei selbstgeschützten Aktionen auszugrauen, statt den Nutzer in
     * einen 409 laufen zu lassen — die Prüfung im Service bleibt die Wahrheit, das Flag ist nur UX.
     *
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function userDetail(array $row, int $viewerId): array
    {
        return $this->userRow($row) + [
            'bio_markdown'     => $row['bio_markdown'] ?? null,
            'experience_level' => $row['experience_level'] ?? null,
            'license_class'    => $row['license_class'] ?? null,
            'glider'           => $row['glider'] ?? null,
            'home_region'      => $row['home_region'] ?? null,
            'flight_hours'     => isset($row['flight_hours']) ? (int) $row['flight_hours'] : null,
            'is_self'          => (int) $row['id'] === $viewerId,
        ];
    }

    /**
     * Zeile der Treffen-Liste. Zeigt **beides**: den persistierten `status` (`open|cancelled`) und den
     * beim Lesen abgeleiteten `derived_status` (`full`/`finished`) — für den Admin ist genau diese
     * Unterscheidung interessant.
     *
     * @param array<string, mixed> $row
     * @param array<string, mixed>|null $creator PublicUserCard oder null (Profilzeile fehlt)
     * @return array<string, mixed>
     */
    public function meetupRow(array $row, ?array $creator): array
    {
        $count = (int) ($row['participant_count'] ?? 0);
        $max   = $row['max_participants'] !== null ? (int) $row['max_participants'] : null;

        return [
            'id'                => (int) $row['id'],
            'title'             => $row['title'],
            'spot_name'         => $row['spot_name'] ?? null,
            'region'            => $row['region'] ?? null,
            'starts_at'         => $this->toIso($row['starts_at'] ?? null),
            'status'            => $row['status'],
            // Wiederverwendet die Ableitung der öffentlichen Projektion — der Admin darf keinen
            // abweichenden Status sehen, sonst wäre die Ansicht wertlos.
            'derived_status'    => (new MeetupPresenter())->deriveStatus($row['status'], (string) $row['starts_at'], $max, $count),
            'participant_count' => $count,
            'max_participants'  => $max,
            'creator'           => $creator,
            'created_at'        => $this->toIso($row['created_at'] ?? null),
        ];
    }

    /**
     * Zeile der Gruppen-Liste — inkl. `deleted_at`, denn die Admin-Liste zeigt auch soft-gelöschte Gruppen.
     *
     * @param array<string, mixed> $row
     * @param array<string, mixed>|null $owner
     * @return array<string, mixed>
     */
    public function groupRow(array $row, ?array $owner): array
    {
        return [
            'id'            => (int) $row['id'],
            'name'          => $row['name'],
            'slug'          => $row['slug'],
            'visibility'    => $row['visibility'],
            'join_policy'   => $row['join_policy'],
            'members_count' => (int) $row['members_count'],
            'owner'         => $owner,
            'created_at'    => $this->toIso($row['created_at'] ?? null),
            'deleted_at'    => $this->toIso($row['deleted_at'] ?? null),
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function spot(array $row): array
    {
        return [
            'id'            => (int) $row['id'],
            'name'          => $row['name'],
            'region'        => $row['region'],
            'country'       => $row['country'],
            'lat'           => (float) $row['lat'],
            'lng'           => (float) $row['lng'],
            'type'          => $row['type'],
            'description'   => $row['description'] ?? null,
            'meetups_count' => (int) $row['meetups_count'],
        ];
    }

    /**
     * Kennzahlen der Übersicht. Kommt bereits typrein aus dem StatsService — hier nur durchgereicht,
     * damit die Vertragsfläche an *einer* Stelle sichtbar bleibt.
     *
     * @param array<string, array<string, int>> $stats
     * @return array<string, array<string, int>>
     */
    public function stats(array $stats): array
    {
        return $stats;
    }

    /** MySQL-DATETIME → ISO-8601 (UTC; appTimezone = UTC). */
    private function toIso(?string $datetime): ?string
    {
        return $datetime === null ? null : str_replace(' ', 'T', $datetime) . 'Z';
    }
}
