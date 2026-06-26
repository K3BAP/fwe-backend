import { ApiError } from '@/api/http'
import type {
  ExperienceLevel,
  MeetupCreateInput,
  MeetupDetail,
  MeetupListItem,
  MeetupStatus,
  PublicUserCard,
} from '@/api/schemas'
import { sessionMock } from './session'
import { spotsTable } from './spots'
import { usersTable } from './users'

/**
 * Veränderlicher In-Memory-Datensatz der Flugtreffen (M1-Mock). Gespeichert wird ein **Record**
 * (Obermenge); Listen-/Detail-Projektionen + abgeleiteter Status werden beim Lesen berechnet,
 * sodass Teilnahme-Mutationen `open`↔`full` automatisch umschalten. In M3 ersetzt durch echte
 * Endpunkte — Hooks/Komponenten bleiben gleich.
 */
type MeetupRecord = {
  id: number
  title: string
  spot_id: number
  starts_at: string // ISO-8601
  experience_level: ExperienceLevel
  max_participants: number | null
  description: string | null
  creator_id: number
  participant_ids: number[] // inkl. Ersteller (zählt zur Kapazität, ADR-015)
  cancelled: boolean
  finished: boolean // vergangenes starts_at (im Mock vorab gesetzt)
}

const meetups: MeetupRecord[] = [
  {
    id: 1,
    title: 'Abendthermik am Tegelberg',
    spot_id: 2,
    starts_at: '2026-07-04T17:00:00+02:00',
    experience_level: 'advanced',
    max_participants: 12,
    description:
      'Gemeinsamer Abendflug bei hoffentlich schöner Restthermik. Treffpunkt am oberen Parkplatz, Fahrgemeinschaften willkommen. Schirm-Check vor dem Start nicht vergessen!',
    creator_id: 1,
    participant_ids: [1, 2, 4, 5, 6, 7, 8, 3],
    cancelled: false,
    finished: false,
  },
  {
    id: 2,
    title: 'Frühflug Wasserkuppe',
    spot_id: 1,
    starts_at: '2026-07-05T08:30:00+02:00',
    experience_level: 'beginner',
    max_participants: 6,
    description: 'Ruhiger Morgenflug am Westhang – ideal für frische A-Scheine. Kleine Gruppe, viel Betreuung.',
    creator_id: 2,
    participant_ids: [2, 3, 4, 5, 6, 7],
    cancelled: false,
    finished: false,
  },
  {
    id: 3,
    title: 'XC-Streckenflug Brauneck',
    spot_id: 3,
    starts_at: '2026-07-06T10:00:00+02:00',
    experience_level: 'expert',
    max_participants: 10,
    description: 'Ambitionierter Streckentag Richtung Karwendel. Funk und Live-Tracking empfohlen.',
    creator_id: 3,
    participant_ids: [3, 1, 8],
    cancelled: false,
    finished: false,
  },
  {
    id: 4,
    title: 'Soaring am Calmont',
    spot_id: 28,
    starts_at: '2026-07-11T14:00:00+02:00',
    experience_level: 'all',
    max_participants: null,
    description: 'Dynamischer Hangflug überm Moseltal. Offen für alle Level – Soaring-Bedingungen vorausgesetzt.',
    creator_id: 4,
    participant_ids: [4, 5, 6, 2, 7],
    cancelled: false,
    finished: false,
  },
  {
    id: 5,
    title: 'Hike & Fly Stubaital',
    spot_id: 12,
    starts_at: '2026-07-12T09:00:00+02:00',
    experience_level: 'advanced',
    max_participants: 8,
    description: 'Aufstieg zum Elfer, dann gemeinsamer Abflug. Leichtes Gepäck, gute Kondition nötig.',
    creator_id: 5,
    participant_ids: [5, 1, 6, 8],
    cancelled: false,
    finished: false,
  },
  {
    id: 6,
    title: 'Anfänger-Übungstag Schwäbische Alb',
    spot_id: 24,
    starts_at: '2026-06-20T11:00:00+02:00',
    experience_level: 'beginner',
    max_participants: 12,
    description: 'Übungshang-Session in Beuren mit Groundhandling und kurzen Hüpfern.',
    creator_id: 6,
    participant_ids: [6, 2, 3, 4, 5, 7, 8, 9, 10],
    cancelled: false,
    finished: true,
  },
  {
    id: 7,
    title: 'Gleitschirm-Treffen Hochfelln',
    spot_id: 4,
    starts_at: '2026-07-18T13:30:00+02:00',
    experience_level: 'advanced',
    max_participants: 10,
    description: 'Leider abgesagt wegen unsicherer Wetterlage – wir verschieben auf nächste Woche.',
    creator_id: 7,
    participant_ids: [7, 2],
    cancelled: true,
    finished: false,
  },
  {
    id: 8,
    title: 'Thermikfliegen Gerlitzen',
    spot_id: 15,
    starts_at: '2026-07-20T11:00:00+02:00',
    experience_level: 'advanced',
    max_participants: 15,
    description: 'Klassiker über dem Ossiacher See. Lange Flüge bei guter Thermik möglich.',
    creator_id: 8,
    participant_ids: [8, 2, 3, 4, 5, 9],
    cancelled: false,
    finished: false,
  },
  {
    id: 9,
    title: 'Sonnenaufgangsflug Wallberg',
    spot_id: 8,
    starts_at: '2026-06-15T06:00:00+02:00',
    experience_level: 'advanced',
    max_participants: 8,
    description: 'Magischer Morgenflug überm Tegernsee. Früh aufstehen lohnt sich.',
    creator_id: 2,
    participant_ids: [2, 3, 4, 5, 6, 7, 9],
    cancelled: false,
    finished: true,
  },
  {
    id: 10,
    title: 'Kössen Cross-Country',
    spot_id: 13,
    starts_at: '2026-07-25T10:30:00+02:00',
    experience_level: 'expert',
    max_participants: 10,
    description: 'Strecke Richtung Kaisergebirge. Erfahrung mit großen Talquerungen empfohlen.',
    creator_id: 9,
    participant_ids: [9, 3, 4, 8],
    cancelled: false,
    finished: false,
  },
  {
    id: 11,
    title: 'Eifel-Treff Nürburg',
    spot_id: 29,
    starts_at: '2026-07-08T15:00:00+02:00',
    experience_level: 'all',
    max_participants: 20,
    description: 'Lockeres Treffen an der Hohen Acht mit anschließendem Grillen am Landeplatz.',
    creator_id: 10,
    participant_ids: [10, 2, 3, 4, 5, 6, 7, 8],
    cancelled: false,
    finished: false,
  },
  {
    id: 12,
    title: 'Vol Biv Interlaken',
    spot_id: 19,
    starts_at: '2026-08-01T08:00:00+02:00',
    experience_level: 'expert',
    max_participants: 6,
    description: 'Zweitägige Biwak-Tour im Berner Oberland. Begrenzte Plätze, Erfahrung Pflicht.',
    creator_id: 3,
    participant_ids: [3, 4, 5, 6, 7, 8],
    cancelled: false,
    finished: false,
  },
  {
    id: 13,
    title: 'Schwarzwald Soaring Kandel',
    spot_id: 26,
    starts_at: '2026-07-14T13:00:00+02:00',
    experience_level: 'beginner',
    max_participants: 14,
    description: 'Entspanntes Hangsoaring für Einsteiger und Wiedereinsteiger.',
    creator_id: 4,
    participant_ids: [4, 5, 1, 2, 6],
    cancelled: false,
    finished: false,
  },
  {
    id: 14,
    title: 'Akro-Session Achensee',
    spot_id: 17,
    starts_at: '2026-06-10T12:00:00+02:00',
    experience_level: 'expert',
    max_participants: 8,
    description: 'Sicherheitstraining überm Wasser mit Rettungsboot. Nur mit Akro-Erfahrung.',
    creator_id: 8,
    participant_ids: [8, 2, 3, 4, 5, 6],
    cancelled: false,
    finished: true,
  },
]

let nextId = meetups.length + 1

function statusOf(r: MeetupRecord): MeetupStatus {
  if (r.cancelled) return 'cancelled'
  if (r.finished) return 'finished'
  if (r.max_participants != null && r.participant_ids.length >= r.max_participants) return 'full'
  return 'open'
}

function toListItem(r: MeetupRecord): MeetupListItem {
  const spot = spotsTable.byId(r.spot_id)
  const count = r.participant_ids.length
  return {
    id: r.id,
    title: r.title,
    spot_name: spot?.name ?? 'Unbekannter Spot',
    region: spot?.region ?? '—',
    starts_at: r.starts_at,
    experience_level: r.experience_level,
    participant_count: count,
    max_participants: r.max_participants,
    free_spots: r.max_participants != null ? Math.max(0, r.max_participants - count) : null,
    derived_status: statusOf(r),
    lat: spot?.lat ?? null,
    lng: spot?.lng ?? null,
  }
}

function toDetail(r: MeetupRecord): MeetupDetail {
  const me = sessionMock.me()
  return {
    ...toListItem(r),
    spot_id: r.spot_id,
    creator_user_id: r.creator_id,
    description: r.description,
    participants: usersTable.resolve(r.participant_ids),
    is_participant: me ? r.participant_ids.includes(me.id) : false,
    can_edit: me ? r.creator_id === me.id : false,
  }
}

function find(id: number): MeetupRecord {
  const r = meetups.find((m) => m.id === id)
  if (!r) throw new ApiError('not_found', 'Flugtreffen nicht gefunden.', 404)
  return r
}

export const meetupsTable = {
  list: (): MeetupListItem[] => meetups.map(toListItem),
  detail: (id: number): MeetupDetail => toDetail(find(id)),

  /** Teilnahme zusagen (idempotent). Wirft 409 bei abgesagt/beendet/ausgebucht. */
  join: (id: number, user: PublicUserCard): MeetupDetail => {
    const r = find(id)
    if (r.cancelled || r.finished) throw new ApiError('conflict', 'Treffen ist nicht beitretbar.', 409)
    if (!r.participant_ids.includes(user.id)) {
      if (r.max_participants != null && r.participant_ids.length >= r.max_participants) {
        throw new ApiError('full', 'Treffen ist ausgebucht.', 409)
      }
      r.participant_ids.push(user.id)
    }
    return toDetail(r)
  },

  leave: (id: number, userId: number): MeetupDetail => {
    const r = find(id)
    r.participant_ids = r.participant_ids.filter((pid) => pid !== userId)
    return toDetail(r)
  },

  create: (input: MeetupCreateInput): MeetupDetail => {
    const meId = sessionMock.me()?.id ?? 1
    const r: MeetupRecord = {
      id: nextId++,
      title: input.title,
      spot_id: input.spot_id,
      starts_at: input.starts_at,
      experience_level: input.experience_level,
      max_participants: input.max_participants,
      description: input.description,
      creator_id: meId,
      participant_ids: [meId],
      cancelled: false,
      finished: false,
    }
    meetups.unshift(r)
    return toDetail(r)
  },

  /** Treffen bearbeiten (Organisator). */
  update: (id: number, input: MeetupCreateInput): MeetupDetail => {
    const r = find(id)
    r.title = input.title
    r.spot_id = input.spot_id
    r.starts_at = input.starts_at
    r.experience_level = input.experience_level
    r.max_participants = input.max_participants
    r.description = input.description
    return toDetail(r)
  },

  /** Treffen absagen (Status → cancelled). */
  cancel: (id: number): MeetupDetail => {
    const r = find(id)
    r.cancelled = true
    return toDetail(r)
  },

  /** Treffen löschen. */
  remove: (id: number): void => {
    const i = meetups.findIndex((m) => m.id === id)
    if (i >= 0) meetups.splice(i, 1)
  },

  /** Teilnehmer entfernen (Organisator). */
  removeParticipant: (id: number, userId: number): MeetupDetail => {
    const r = find(id)
    r.participant_ids = r.participant_ids.filter((p) => p !== userId)
    return toDetail(r)
  },

  /** Eindeutige Regionen (alphabetisch) für den Filter-Dropdown. */
  regions: (): string[] =>
    [...new Set(meetups.map((r) => spotsTable.byId(r.spot_id)?.region ?? '—'))].sort((a, b) => a.localeCompare(b, 'de')),
}
