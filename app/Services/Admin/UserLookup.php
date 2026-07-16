<?php

namespace App\Services\Admin;

use App\Services\ProfilePresenter;

/**
 * Löst Nutzer-IDs **gebündelt** zu PublicUserCards auf: eine Abfrage je Seite statt einer je Zeile.
 *
 * Existiert, weil die Admin-Listen ihre Zeilen aus der rohen Tabelle holen und den Ersteller/Owner erst
 * danach brauchen — ein Join je Zeile wäre N+1. Die Karte kommt aus {@see ProfilePresenter}, damit das
 * verschachtelte `creator`/`owner`-Objekt überall im API byte-identisch ist (das Frontend nutzt dafür
 * dasselbe Zod-Schema wieder).
 */
final class UserLookup
{
    /**
     * @param list<int> $userIds
     * @return array<int, array<string, mixed>> user_id → PublicUserCard
     */
    public function cardsFor(array $userIds): array
    {
        $ids = array_values(array_unique(array_filter($userIds)));
        if ($ids === []) {
            return [];
        }

        $rows = db_connect()->table('profiles')
            ->select('user_id, display_name, handle, avatar_path')
            ->whereIn('user_id', $ids)
            ->get()->getResultArray();

        $presenter = new ProfilePresenter();
        $cards     = [];
        foreach ($rows as $row) {
            $cards[(int) $row['user_id']] = $presenter->publicUserCard($row);
        }

        return $cards;
    }
}
