import { describe, it, expect } from 'vitest'
import { compassPoint, formatMeetupDate, formatClock, formatRelativeTime, formatTemperature, formatWindSpeed } from './format'

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

  it('formatWindSpeed/formatTemperature runden auf ganze Zahlen', () => {
    expect(formatWindSpeed(12.4)).toBe('12 km/h')
    expect(formatTemperature(21.5)).toBe('22 °C')
  })

  it('compassPoint: Grad → dt. Himmelsrichtung (8 Sektoren, Ränder eingeschlossen)', () => {
    expect(compassPoint(0)).toBe('N')
    expect(compassPoint(90)).toBe('O')
    expect(compassPoint(225)).toBe('SW')
    expect(compassPoint(350)).toBe('N') // rundet über 360° zurück auf Nord
    expect(compassPoint(-45)).toBe('NW') // negative Winkel bleiben gültig
  })
})
