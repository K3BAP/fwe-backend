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

    /** MySQL-DATETIME → ISO-8601 (UTC; appTimezone = UTC). */
    private function toIso(?string $datetime): ?string
    {
        return $datetime === null ? null : str_replace(' ', 'T', $datetime) . 'Z';
    }
}
