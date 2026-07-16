import { describe, expect, it } from 'vitest'
import type { MeetupDetail } from '@/api/schemas'
import { meetupFormDefaults, toMeetupInput } from './meetupFormSchema'

const meetup: MeetupDetail = {
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

describe('meetupFormDefaults', () => {
  it('liefert ein leeres Formular ohne Treffen', () => {
    expect(meetupFormDefaults()).toEqual({
      title: '',
      spot_id: 0,
      date: '',
      time: '',
      experience_level: 'all',
      max_participants: '',
      description: '',
    })
  })

  it('übernimmt die Werte eines bestehenden Treffens (Zahlen als Formular-Strings)', () => {
    const values = meetupFormDefaults(meetup)

    expect(values.title).toBe('Abendthermik am Tegelberg')
    expect(values.spot_id).toBe(2)
    expect(values.experience_level).toBe('advanced')
    expect(values.max_participants).toBe('12')
    expect(values.description).toBe('Treffpunkt an der Bergstation.')
  })

  it('verlangt bei gelöschtem Startplatz eine Neuwahl (spot_id null → 0)', () => {
    expect(meetupFormDefaults({ ...meetup, spot_id: null }).spot_id).toBe(0)
  })

  it('lässt ein unbegrenztes Treffen leer statt „0" zu schreiben', () => {
    expect(meetupFormDefaults({ ...meetup, max_participants: null, description: null })).toMatchObject({
      max_participants: '',
      description: '',
    })
  })
})

describe('toMeetupInput', () => {
  /**
   * Der Rundlauf ist die eigentliche Zusicherung: `meetupFormDefaults` zerlegt `starts_at` in lokale
   * Datums-/Uhrzeit-Strings, `toMeetupInput` setzt sie wieder zusammen. Verrutschte dabei die Zone,
   * verschöbe jedes Speichern den Termin — deshalb wird auf den Zeitpunkt verglichen, nicht auf den
   * String (die Zeitzone der Testmaschine darf keine Rolle spielen).
   */
  it('führt Datum und Uhrzeit ohne Zeitversatz zu starts_at zurück', () => {
    const input = toMeetupInput(meetupFormDefaults(meetup))

    expect(new Date(input.starts_at).getTime()).toBe(new Date(meetup.starts_at).getTime())
  })

  it('macht aus leeren Optionalfeldern null, nicht „" oder 0', () => {
    const input = toMeetupInput({ ...meetupFormDefaults(meetup), max_participants: '  ', description: '  ' })

    expect(input.max_participants).toBeNull()
    expect(input.description).toBeNull()
  })

  it('schickt das Platzlimit als Zahl', () => {
    expect(toMeetupInput({ ...meetupFormDefaults(meetup), max_participants: '12' }).max_participants).toBe(12)
  })
})
