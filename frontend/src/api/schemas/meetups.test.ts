import { describe, expect, it } from 'vitest'
import { meetupDetailSchema } from './meetups'

/**
 * Vertragstest der Detail-Projektion. Interessant ist hier vor allem `spot_id`: `meetups.spot_id` ist
 * `ON DELETE SET NULL`, ein gelöschter Startplatz liefert also echtes `null`. War das Feld nicht
 * nullable, scheiterte der Parse und die Detailseite meldete „Treffen nicht gefunden" — obwohl der
 * Server sauber antwortet und Name/Koordinaten als Snapshot auf der Zeile stehen.
 */
const detail = {
  id: 2,
  title: 'Abendthermik am Tegelberg',
  spot_name: 'Tegelberg',
  region: 'Allgäu',
  starts_at: '2026-09-15T14:30:00Z',
  experience_level: 'advanced',
  participant_count: 3,
  max_participants: 12,
  free_spots: 9,
  derived_status: 'open',
  lat: 47.585,
  lng: 10.764,
  spot_id: 2,
  creator_user_id: 3,
  conversation_id: 5,
  description: 'Treffpunkt an der Bergstation.',
  participants: [],
  is_participant: false,
  can_edit: true,
}

describe('meetupDetail (API-Vertrag)', () => {
  it('akzeptiert ein vollständiges Treffen', () => {
    expect(meetupDetailSchema.safeParse(detail).success).toBe(true)
  })

  it('akzeptiert spot_id null — der Startplatz wurde gelöscht', () => {
    expect(meetupDetailSchema.safeParse({ ...detail, spot_id: null, lat: null, lng: null }).success).toBe(true)
  })

  it('verwirft spot_id als String (MySQL-Rohwert)', () => {
    expect(meetupDetailSchema.safeParse({ ...detail, spot_id: '2' }).success).toBe(false)
  })
})
