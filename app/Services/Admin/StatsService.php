<?php

namespace App\Services\Admin;

/**
 * Kennzahlen der Admin-Übersicht (ADR-019).
 *
 * Vier Aggregat-Abfragen (plus eine für die Admin-Zahl) statt einer UNION: heterogene Aggregate in
 * einer UNION bräuchten Füllspalten und einen Diskriminator — unleserlich, bei gleicher Anzahl Scans.
 * So liest sich der Code wie das DTO, das er erzeugt.
 *
 * Zeitvergleiche über `UTC_TIMESTAMP()`, nie `NOW()`: der Zeitzonen-Pin in `Config/Events.php` macht
 * beide heute gleich, aber `UTC_TIMESTAMP()` bleibt auch dann richtig, wenn der Pin je verloren geht.
 *
 * Bewusst **ohne** Inhalts-Zahlen (Nachrichten/Feed): Moderation ist laut ADR-005/008 nicht Teil des
 * Dashboards — und `COUNT(*)` auf `messages` wäre die einzige Abfrage hier, die wirklich wachsen kann.
 */
final class StatsService
{
    /**
     * MySQL liefert `SUM()` als String — jeder Wert wird gecastet, sonst weist Zods `z.number()` das
     * DTO zurück.
     *
     * @return array<string, array<string, int>>
     */
    public function overview(): array
    {
        $db = db_connect();

        $users = $db->query(
            'SELECT COUNT(*) AS total,
                    SUM(deleted_at IS NULL AND active = 1)  AS active,
                    SUM(deleted_at IS NULL AND active = 0)  AS suspended,
                    SUM(deleted_at IS NOT NULL)             AS deleted,
                    SUM(created_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY) AS new_7d
             FROM users'
        )->getRowArray();

        // Eigene Abfrage statt Join: `group` ist ein reserviertes Wort und die Zahl ist join-frei billiger.
        $admins = $db->query('SELECT COUNT(*) AS admins FROM auth_groups_users WHERE `group` = ?', ['admin'])->getRowArray();

        $meetups = $db->query(
            "SELECT COUNT(*) AS total,
                    SUM(status = 'open' AND starts_at >= UTC_TIMESTAMP()) AS upcoming,
                    SUM(status = 'cancelled')                             AS cancelled
             FROM meetups"
        )->getRowArray();

        $groups = $db->query(
            "SELECT COUNT(*) AS total,
                    SUM(deleted_at IS NULL)                             AS active,
                    SUM(deleted_at IS NOT NULL)                         AS deleted,
                    SUM(visibility = 'private' AND deleted_at IS NULL)  AS private
             FROM `groups`"
        )->getRowArray();

        $spots = $db->query('SELECT COUNT(*) AS total FROM spots')->getRowArray();

        return [
            'users' => [
                'total'     => (int) $users['total'],
                'active'    => (int) $users['active'],
                'suspended' => (int) $users['suspended'],
                'deleted'   => (int) $users['deleted'],
                'admins'    => (int) $admins['admins'],
                'new_7d'    => (int) $users['new_7d'],
            ],
            'meetups' => [
                'total'     => (int) $meetups['total'],
                'upcoming'  => (int) $meetups['upcoming'],
                'cancelled' => (int) $meetups['cancelled'],
            ],
            'groups' => [
                'total'   => (int) $groups['total'],
                'active'  => (int) $groups['active'],
                'deleted' => (int) $groups['deleted'],
                'private' => (int) $groups['private'],
            ],
            'spots' => ['total' => (int) $spots['total']],
        ];
    }
}
