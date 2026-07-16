<?php

namespace App\Services;

use CodeIgniter\Shield\Entities\User;

/**
 * Baut die Profil-DTOs aus Shield-`User` + `profiles`-Zeile (API.md §2/§3). Eine Stelle für die
 * Projektionen, von Auth- **und** Profile-Controller genutzt — die englischen Feldnamen entsprechen
 * exakt dem Wire-Vertrag, den die Zod-Schemas im Frontend spiegeln.
 */
final class ProfilePresenter
{
    /**
     * Öffentliche Nutzer-Kurzform (das `user`-Objekt in Auth-Antworten).
     *
     * @param array<string, mixed> $profile
     * @return array<string, mixed>
     */
    public function publicUser(User $user, array $profile): array
    {
        return [
            'id'           => (int) $user->id,
            'display_name' => $profile['display_name'],
            'handle'       => $profile['handle'],
            'avatar_path'  => $profile['avatar_path'] ?? null,
        ];
    }

    /**
     * Eigenes Profil (self): alle Felder roh + `email`.
     *
     * @param array<string, mixed> $profile
     * @return array<string, mixed>
     */
    public function ownProfile(User $user, array $profile): array
    {
        return [
            'user_id'          => (int) $user->id,
            'email'            => $user->email,
            'display_name'     => $profile['display_name'],
            'handle'           => $profile['handle'],
            'avatar_path'      => $profile['avatar_path'] ?? null,
            'bio_markdown'     => $profile['bio_markdown'] ?? null,
            'experience_level' => $profile['experience_level'] ?? null,
            'license_class'    => $profile['license_class'] ?? null,
            'glider'           => $profile['glider'] ?? null,
            'home_region'      => $profile['home_region'] ?? null,
            'flight_hours'     => isset($profile['flight_hours']) ? (int) $profile['flight_hours'] : null,
            'created_at'       => $this->toIso($profile['created_at'] ?? null),
        ];
    }

    /**
     * Öffentliche Profilkarte (`GET /users/{id}`). **Feldabhängig reduziert** (ADR-012/C2): Bild, Name,
     * Bio, Erfahrungslevel sind immer sichtbar; die „Erweitert"-Felder (Region, Schirm, Lizenz, Stunden)
     * nur für eingeloggte Betrachter. `email` ist **nie** öffentlich.
     *
     * @param array<string, mixed> $profile
     * @return array<string, mixed>
     */
    public function publicProfile(array $profile, bool $authenticated): array
    {
        $card = [
            'user_id'          => (int) $profile['user_id'],
            'display_name'     => $profile['display_name'],
            'handle'           => $profile['handle'],
            'avatar_path'      => $profile['avatar_path'] ?? null,
            'bio_markdown'     => $profile['bio_markdown'] ?? null,
            'experience_level' => $profile['experience_level'] ?? null,
            'created_at'       => $this->toIso($profile['created_at'] ?? null),
        ];

        if ($authenticated) {
            $card['license_class'] = $profile['license_class'] ?? null;
            $card['glider']        = $profile['glider'] ?? null;
            $card['home_region']   = $profile['home_region'] ?? null;
            $card['flight_hours']  = isset($profile['flight_hours']) ? (int) $profile['flight_hours'] : null;
        }

        return $card;
    }

    /**
     * Reduzierte Karte fürs Piloten-Verzeichnis (`GET /users`, API.md „PublicUserCard").
     *
     * @param array<string, mixed> $profile
     * @return array<string, mixed>
     */
    public function publicUserCard(array $profile): array
    {
        return [
            'id'           => (int) $profile['user_id'],
            'display_name' => $profile['display_name'],
            'handle'       => $profile['handle'],
            'avatar_path'  => $profile['avatar_path'] ?? null,
        ];
    }

    /** MySQL-DATETIME → ISO-8601 (UTC; appTimezone = UTC). */
    private function toIso(?string $datetime): ?string
    {
        return $datetime === null ? null : str_replace(' ', 'T', $datetime) . 'Z';
    }
}
