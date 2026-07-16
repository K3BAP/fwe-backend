import { describe, expect, it } from 'vitest'
import { userStatusTone } from './userStatus'

/** Die Rangfolge ist die eigentliche Regel: gelöscht schlägt gesperrt schlägt aktiv. */
describe('userStatusTone', () => {
  it('zeigt „Gelöscht", auch wenn das Konto zusätzlich gesperrt ist', () => {
    expect(userStatusTone({ active: false, deleted_at: '2026-07-16T10:00:00Z' })).toEqual({ label: 'Gelöscht', tone: 'error' })
  })

  it('zeigt „Gesperrt" für ein inaktives, nicht gelöschtes Konto', () => {
    expect(userStatusTone({ active: false, deleted_at: null })).toEqual({ label: 'Gesperrt', tone: 'warning' })
  })

  it('zeigt „Aktiv" sonst', () => {
    expect(userStatusTone({ active: true, deleted_at: null })).toEqual({ label: 'Aktiv', tone: 'success' })
  })
})
