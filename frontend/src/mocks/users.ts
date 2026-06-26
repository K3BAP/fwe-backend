import type { PublicUserCard } from '@/api/schemas'

/**
 * Geteilter Pool von Pilot-Profilen (M1-Mock). Quelle für Treffen-Teilnehmer, Gruppen-Mitglieder,
 * Chat-Absender & DMs. `id: 1` = Session-User (siehe [[session]]). avatar_path null → Initialen.
 */
const users: PublicUserCard[] = [
  { id: 1, display_name: 'Lena Krüger', handle: 'lenak', avatar_path: null },
  { id: 2, display_name: 'Markus Thaler', handle: 'thaler_fly', avatar_path: null },
  { id: 3, display_name: 'Sophie Berg', handle: 'sophieb', avatar_path: null },
  { id: 4, display_name: 'Jonas Weber', handle: 'jweber', avatar_path: null },
  { id: 5, display_name: 'Mara Lindner', handle: 'mara_l', avatar_path: null },
  { id: 6, display_name: 'Tobias Frank', handle: 'tobi', avatar_path: null },
  { id: 7, display_name: 'Nina Hoffmann', handle: 'ninah', avatar_path: null },
  { id: 8, display_name: 'David Costa', handle: 'dcosta', avatar_path: null },
  { id: 9, display_name: 'Pia Sommer', handle: 'piasommer', avatar_path: null },
  { id: 10, display_name: 'Elias Wolf', handle: 'eliw', avatar_path: null },
]

const byId = new Map(users.map((u) => [u.id, u]))

export const usersTable = {
  list: (): PublicUserCard[] => users.map((u) => ({ ...u })),
  byId: (id: number): PublicUserCard | undefined => {
    const u = byId.get(id)
    return u ? { ...u } : undefined
  },
  /** Löst eine Liste von IDs zu Karten auf (unbekannte IDs werden verworfen). */
  resolve: (ids: number[]): PublicUserCard[] =>
    ids.map((id) => byId.get(id)).filter((u): u is PublicUserCard => Boolean(u)).map((u) => ({ ...u })),
}
