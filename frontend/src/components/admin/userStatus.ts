import type { AdminUserRow } from '@/api/schemas'
import type { PillTone } from '@/components/ui'

/**
 * Anzeige-Status eines Kontos. **Die Reihenfolge zählt:** gelöscht schlägt gesperrt schlägt aktiv —
 * ein gelöschtes Konto ist meist auch nicht mehr „aktiv", und ohne feste Rangfolge zeigten zwei
 * Tabellen dieselbe Zeile unterschiedlich. Deshalb hier einmal zentral statt inline im JSX.
 */
export function userStatusTone(user: Pick<AdminUserRow, 'active' | 'deleted_at'>): { label: string; tone: PillTone } {
  if (user.deleted_at) return { label: 'Gelöscht', tone: 'error' }
  if (!user.active) return { label: 'Gesperrt', tone: 'warning' }
  return { label: 'Aktiv', tone: 'success' }
}
