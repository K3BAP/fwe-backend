import { describe, expect, it } from 'vitest'
import { adminSpotInputSchema, adminSpotSchema, adminStatsSchema, adminUserRowSchema } from './admin'

/**
 * Vertragstests des Admin-DTOs (ADR-019). Sie halten genau die Stellen fest, an denen der Server
 * casten **muss**: MySQL liefert `active` als 0/1, `COUNT`/`SUM` und `DECIMAL` als String. Fiele ein
 * Cast weg, schlüge hier `parse()` fehl statt dass stillschweigend Unsinn ins UI liefe.
 */

const userRow = {
  id: 3,
  display_name: 'Lena Krüger',
  handle: 'lena_xc',
  avatar_path: null,
  email: 'lena@flightmeet.test',
  is_admin: false,
  active: true,
  created_at: '2026-06-26T10:00:00Z',
  last_active: null,
  deleted_at: null,
  meetups_count: 4,
  groups_count: 2,
}

describe('adminUserRow (API-Vertrag)', () => {
  it('akzeptiert eine Zeile mit leeren Optionalfeldern', () => {
    expect(adminUserRowSchema.safeParse({ ...userRow, email: null, handle: null, deleted_at: null }).success).toBe(true)
  })

  it('verwirft eine fehlende id', () => {
    expect(adminUserRowSchema.safeParse({ ...userRow, id: undefined }).success).toBe(false)
  })

  it('verwirft active als 0/1 statt bool (MySQL-Rohwert)', () => {
    expect(adminUserRowSchema.safeParse({ ...userRow, active: 1 }).success).toBe(false)
  })

  it('verwirft Zähler als String (MySQL-Rohwert)', () => {
    expect(adminUserRowSchema.safeParse({ ...userRow, meetups_count: '4' }).success).toBe(false)
  })
})

const spot = {
  id: 7,
  name: 'Wallberg',
  region: 'Bayern',
  country: 'DE',
  lat: 47.7042,
  lng: 11.7583,
  type: 'launch',
  description: null,
  meetups_count: 3,
}

describe('adminSpot (API-Vertrag)', () => {
  it('akzeptiert einen Startplatz ohne Beschreibung', () => {
    expect(adminSpotSchema.safeParse(spot).success).toBe(true)
  })

  it('verwirft Koordinaten als String (DECIMAL kommt roh als String)', () => {
    expect(adminSpotSchema.safeParse({ ...spot, lat: '47.7042' }).success).toBe(false)
  })

  it('verwirft einen unbekannten Typ', () => {
    expect(adminSpotSchema.safeParse({ ...spot, type: 'hangar' }).success).toBe(false)
  })
})

describe('adminSpotInput (Formular)', () => {
  const input = { name: 'Wallberg', region: 'Bayern', country: 'DE', lat: '47.7042', lng: '11.7583', type: 'launch', description: '' }

  it('akzeptiert gültige Eingaben', () => {
    expect(adminSpotInputSchema.safeParse(input).success).toBe(true)
  })

  it('verwirft einen Breitengrad außerhalb von ±90', () => {
    expect(adminSpotInputSchema.safeParse({ ...input, lat: '91' }).success).toBe(false)
  })

  it('verwirft einen Längengrad außerhalb von ±180', () => {
    expect(adminSpotInputSchema.safeParse({ ...input, lng: '181' }).success).toBe(false)
  })

  it('verwirft leere und nicht-numerische Koordinaten', () => {
    expect(adminSpotInputSchema.safeParse({ ...input, lat: '' }).success).toBe(false)
    expect(adminSpotInputSchema.safeParse({ ...input, lat: 'Nord' }).success).toBe(false)
  })

  it('verwirft einen zu kurzen Ländercode', () => {
    expect(adminSpotInputSchema.safeParse({ ...input, country: 'D' }).success).toBe(false)
  })
})

describe('adminStats (API-Vertrag)', () => {
  const stats = {
    users: { total: 16, active: 15, suspended: 0, deleted: 1, admins: 1, new_7d: 2 },
    meetups: { total: 18, upcoming: 5, cancelled: 2 },
    groups: { total: 8, active: 8, deleted: 0, private: 2 },
    spots: { total: 30 },
  }

  it('akzeptiert vollständige Kennzahlen', () => {
    expect(adminStatsSchema.safeParse(stats).success).toBe(true)
  })

  it('verwirft SUM()-Ergebnisse als String', () => {
    expect(adminStatsSchema.safeParse({ ...stats, users: { ...stats.users, active: '15' } }).success).toBe(false)
  })
})
