import { ApiError } from '@/api/http'
import type { PilotExperience, Profile, ProfileEditInput } from '@/api/schemas'
import { sessionMock } from './session'
import { usersTable } from './users'

/**
 * Profil-Detaildaten je Nutzer (M1-Mock). Name/Handle/Avatar leben in [[users]] (Quelle für Listen
 * & Chat); hier nur die Profil-Zusatzfelder. Bearbeiten aktualisiert beide Stores + den authStore.
 */
type ProfileRecord = {
  bio: string | null
  experience_level: PilotExperience | null
  license_class: string | null
  glider: string | null
  home_region: string | null
  flight_hours: number | null
  created_at: string
}

const profiles: Record<number, ProfileRecord> = {
  1: { bio: 'Fliege seit 2019, am liebsten Streckenflug im Allgäu. Immer für einen Abendflug zu haben. 🪂', experience_level: 'advanced', license_class: 'B-Schein', glider: 'Nova Mentor 7', home_region: 'Allgäu', flight_hours: 320, created_at: '2024-09-01' },
  2: { bio: 'Vereinsmensch & Wetterfuchs. Organisiere gern Treffen.', experience_level: 'expert', license_class: 'B-Schein', glider: 'Ozone Rush 6', home_region: 'Rhön', flight_hours: 780, created_at: '2024-05-12' },
  3: { bio: null, experience_level: 'advanced', license_class: 'A-Schein', glider: 'Gin Explorer 2', home_region: 'Tirol', flight_hours: 210, created_at: '2025-01-20' },
  4: { bio: 'Hangsoaring an der Mosel ist mein Zuhause.', experience_level: 'advanced', license_class: 'B-Schein', glider: 'Advance Alpha 7', home_region: 'Mosel', flight_hours: 180, created_at: '2025-03-08' },
  5: { bio: 'Hike & Fly über alles. Leichtes Setup, lange Touren.', experience_level: 'expert', license_class: 'B-Schein', glider: 'Skywalk Cumeo', home_region: 'Tirol', flight_hours: 540, created_at: '2024-11-02' },
  6: { bio: null, experience_level: 'beginner', license_class: 'A-Schein', glider: 'Nova Prion 5', home_region: 'Eifel', flight_hours: 35, created_at: '2026-01-10' },
  7: { bio: 'Wochenend-Pilotin, lerne ständig dazu.', experience_level: 'beginner', license_class: 'A-Schein', glider: null, home_region: 'Chiemgau', flight_hours: 48, created_at: '2026-02-18' },
  8: { bio: 'Akro & SIV. Sicherheit zuerst.', experience_level: 'expert', license_class: 'B-Schein', glider: 'Ozone Trickster', home_region: 'Tirol', flight_hours: 920, created_at: '2024-07-15' },
  9: { bio: null, experience_level: 'advanced', license_class: null, glider: null, home_region: 'Rhön', flight_hours: 130, created_at: '2026-04-18' },
  10: { bio: 'Neu dabei und voller Vorfreude!', experience_level: 'beginner', license_class: 'A-Schein', glider: 'Nova Prion 5', home_region: 'Tirol', flight_hours: 22, created_at: '2026-06-01' },
}

const meId = () => sessionMock.me()?.id ?? 1

function toProfile(userId: number): Profile {
  const u = usersTable.byId(userId)
  if (!u) throw new ApiError('not_found', 'Profil nicht gefunden.', 404)
  const p = profiles[userId]
  return {
    user_id: userId,
    display_name: u.display_name,
    handle: u.handle,
    avatar_path: u.avatar_path,
    bio: p?.bio ?? null,
    experience_level: p?.experience_level ?? null,
    license_class: p?.license_class ?? null,
    glider: p?.glider ?? null,
    home_region: p?.home_region ?? null,
    flight_hours: p?.flight_hours ?? null,
    created_at: p?.created_at ?? '2025-01-01',
    is_self: meId() === userId,
  }
}

export const profilesTable = {
  get: toProfile,

  updateSelf: (input: ProfileEditInput): Profile => {
    const id = meId()
    const handle = input.handle && input.handle.trim() !== '' ? input.handle : null
    usersTable.update(id, {
      display_name: input.display_name,
      handle,
      ...(input.avatar_path !== undefined ? { avatar_path: input.avatar_path } : {}),
    })
    const existing = profiles[id] ?? { bio: null, experience_level: null, license_class: null, glider: null, home_region: null, flight_hours: null, created_at: '2024-09-01' }
    profiles[id] = {
      ...existing,
      bio: input.bio.trim() || null,
      experience_level: input.experience_level === '' ? null : input.experience_level,
      license_class: input.license_class.trim() || null,
      glider: input.glider.trim() || null,
      home_region: input.home_region.trim() || null,
      flight_hours: input.flight_hours.trim() === '' ? null : Number(input.flight_hours) || null,
    }
    return toProfile(id)
  },
}
