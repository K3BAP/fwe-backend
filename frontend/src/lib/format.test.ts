import { describe, it, expect } from 'vitest'
import { formatMeetupDate, formatClock, formatRelativeTime } from './format'

describe('lib/format', () => {
  it('formatMeetupDate: ISO → dt. Datum · Uhrzeit', () => {
    const s = formatMeetupDate('2026-06-28T15:00:00Z')
    expect(s).toContain('·')
    expect(s).toMatch(/\d{1,2}:\d{2}/) // HH:MM (TZ-unabhängig nur die Struktur prüfen)
  })

  it('formatClock: nur HH:MM', () => {
    expect(formatClock('2026-06-28T15:30:00Z')).toMatch(/^\d{2}:\d{2}$/)
  })

  it('formatRelativeTime: jetzt → „gerade eben"', () => {
    expect(formatRelativeTime(new Date().toISOString())).toBe('gerade eben')
  })

  it('formatRelativeTime: 2 Stunden in der Vergangenheit → „vor …"', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString()
    expect(formatRelativeTime(twoHoursAgo)).toMatch(/vor/)
  })
})
