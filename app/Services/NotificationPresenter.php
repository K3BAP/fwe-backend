<?php

namespace App\Services;

/**
 * Baut die Notification-DTOs (API.md §11) aus Tabellenzeilen (+ Actor-`profiles`-Join). `text` und
 * `link` werden **hier** serverseitig aus `type` + `actor` + `data`(JSON) erzeugt — das Frontend
 * rendert sie nur (Feldform = `notificationSchema`). Vorlagen spiegeln den committeten Mock-Wortlaut.
 */
final class NotificationPresenter
{
    /**
     * @param array<string, mixed> $row notifications-Zeile + actor_* (profiles-Join) + `data`(JSON)
     * @return array<string, mixed>
     */
    public function present(array $row): array
    {
        $data  = $this->decodeData($row['data'] ?? null);
        $actor = ($row['actor_user_id'] !== null && isset($row['actor_display_name']))
            ? [
                'id'           => (int) $row['actor_user_id'],
                'display_name' => $row['actor_display_name'],
                'handle'       => $row['actor_handle'],
                'avatar_path'  => $row['actor_avatar'] ?? null,
            ]
            : null;

        return [
            'id'         => (int) $row['id'],
            'type'       => $row['type'],
            'actor'      => $actor,
            'text'       => $this->text((string) $row['type'], $actor['display_name'] ?? 'Jemand', $data),
            'link'       => $this->link((string) $row['type'], $row['context_type'] ?? null, $row['context_id'] ?? null),
            'read_at'    => $this->toIso($row['read_at'] ?? null),
            'created_at' => (string) $this->toIso($row['created_at']),
        ];
    }

    /**
     * Deutscher Anzeigetext je Typ (Wortlaut wie der Frontend-Mock).
     *
     * @param array<string, mixed> $d Render-Payload (`meetup_title`, `group_name`, …)
     */
    private function text(string $type, string $actor, array $d): string
    {
        $title = (string) ($d['meetup_title'] ?? '');
        $group = (string) ($d['group_name'] ?? '');

        return match ($type) {
            'meetup_join'            => "{$actor} nimmt an „{$title}“ teil.",
            'meetup_cancelled'       => "„{$title}“ wurde abgesagt.",
            'group_join_request'     => "{$actor} möchte dem „{$group}“ beitreten.",
            'group_request_approved' => "Dein Beitritt zu „{$group}“ wurde bestätigt.",
            'group_invite'           => "Du wurdest zu „{$group}“ eingeladen.",
            'group_feed_post'        => "Neuer Beitrag in „{$group}“.",
            'new_message'            => "Neue Nachricht von {$actor}.",
            'message_reaction'       => "{$actor} hat auf deine Nachricht reagiert.",
            default                  => 'Neue Benachrichtigung.',
        };
    }

    /** Ziel-Link (Router-Pfad) je Typ/Kontext; `null`, wenn kein Kontext. */
    private function link(string $type, ?string $ctxType, mixed $ctxId): ?string
    {
        if ($ctxId === null) {
            return null;
        }
        $id = (int) $ctxId;

        // Beitrittsanträge führen auf die Verwaltungsseite der Gruppe.
        if ($type === 'group_join_request') {
            return "/gruppen/{$id}/einstellungen";
        }

        return match ($ctxType) {
            'meetup'       => "/flugtreffen/{$id}",
            'group'        => "/gruppen/{$id}",
            'conversation' => "/chat/{$id}",
            default        => null,
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeData(mixed $data): array
    {
        if (is_array($data)) {
            return $data;
        }
        if ($data === null || $data === '') {
            return [];
        }
        $decoded = json_decode((string) $data, true);

        return is_array($decoded) ? $decoded : [];
    }

    /** MySQL-DATETIME → ISO-8601 (UTC; appTimezone = UTC). */
    private function toIso(?string $datetime): ?string
    {
        return $datetime === null ? null : str_replace(' ', 'T', $datetime) . 'Z';
    }
}
