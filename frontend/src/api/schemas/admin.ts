import { z } from 'zod'
import { publicUserCardSchema } from './common'

/**
 * DTOs des Admin-Bereichs (ADR-019). Spiegeln exakt `app/Services/Admin/AdminPresenter.php` — die
 * Presenter-Ausgabe *ist* der Vertrag, dieses Schema hält ihn fest (Zod strippt Extras).
 *
 * Die strengen Typen sind Absicht: MySQL liefert `active` als 0/1, `COUNT`/`SUM` und `DECIMAL` als
 * String. Das Backend castet deshalb — bräche der Cast weg, schlägt hier `parse()` fehl statt dass
 * stillschweigend Unsinn ins UI läuft.
 */

/** Erfahrungslevel eines Profils — die 3-Wert-Teilmenge ohne „all" (das ist ein Treffen-Filter). */
const profileExperienceSchema = z.enum(['beginner', 'advanced', 'expert'])

/** Zeile der Nutzerliste. `display_name` fällt serverseitig auf „—" zurück, ist also nie null. */
export const adminUserRowSchema = z.object({
  id: z.number(),
  display_name: z.string(),
  handle: z.string().nullable(),
  avatar_path: z.string().nullable(),
  email: z.string().nullable(),
  is_admin: z.boolean(),
  active: z.boolean(),
  created_at: z.string().nullable(),
  last_active: z.string().nullable(),
  deleted_at: z.string().nullable(),
  meetups_count: z.number(),
  groups_count: z.number(),
})
export type AdminUserRow = z.infer<typeof adminUserRowSchema>

/** Detail = Zeile + Profilfelder + `is_self` (graut die selbstgeschützten Aktionen aus). */
export const adminUserDetailSchema = adminUserRowSchema.extend({
  bio_markdown: z.string().nullable(),
  experience_level: profileExperienceSchema.nullable(),
  license_class: z.string().nullable(),
  glider: z.string().nullable(),
  home_region: z.string().nullable(),
  flight_hours: z.number().nullable(),
  is_self: z.boolean(),
})
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>

/** Profil-Edit durch den Admin. `email` fehlt bewusst: sie liegt in `auth_identities` (ADR-008). */
export const adminUserInputSchema = z.object({
  display_name: z.string().min(2, 'Mindestens 2 Zeichen.').max(80, 'Höchstens 80 Zeichen.'),
  handle: z
    .string()
    .regex(/^[a-z0-9_]{3,30}$/, 'Nur a–z, 0–9, _ (3–30 Zeichen).')
    .or(z.literal('')),
  bio_markdown: z.string().max(2000, 'Höchstens 2000 Zeichen.').or(z.literal('')),
  experience_level: profileExperienceSchema.or(z.literal('')),
  license_class: z.string().max(60, 'Höchstens 60 Zeichen.').or(z.literal('')),
  glider: z.string().max(120, 'Höchstens 120 Zeichen.').or(z.literal('')),
  home_region: z.string().max(80, 'Höchstens 80 Zeichen.').or(z.literal('')),
})
export type AdminUserInput = z.infer<typeof adminUserInputSchema>

/**
 * Zeile der Treffen-Liste. Trägt **beides**: den persistierten `status` und den beim Lesen
 * abgeleiteten `derived_status` — für den Admin ist genau der Unterschied interessant.
 */
export const adminMeetupRowSchema = z.object({
  id: z.number(),
  title: z.string(),
  spot_name: z.string().nullable(),
  region: z.string().nullable(),
  starts_at: z.string().nullable(),
  status: z.enum(['open', 'cancelled']),
  derived_status: z.enum(['open', 'full', 'cancelled', 'finished']),
  participant_count: z.number(),
  max_participants: z.number().nullable(),
  creator: publicUserCardSchema.nullable(),
  created_at: z.string().nullable(),
})
export type AdminMeetupRow = z.infer<typeof adminMeetupRowSchema>

/** Zeile der Gruppen-Liste — inkl. `deleted_at`, denn die Admin-Liste zeigt auch Gelöschtes. */
export const adminGroupRowSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  visibility: z.enum(['public', 'unlisted', 'private']),
  join_policy: z.enum(['open', 'request', 'invite_only']),
  members_count: z.number(),
  owner: publicUserCardSchema.nullable(),
  created_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
})
export type AdminGroupRow = z.infer<typeof adminGroupRowSchema>

export const adminSpotTypeSchema = z.enum(['launch', 'landing', 'area'])
export type AdminSpotType = z.infer<typeof adminSpotTypeSchema>

export const adminSpotSchema = z.object({
  id: z.number(),
  name: z.string(),
  region: z.string(),
  country: z.string(),
  lat: z.number(),
  lng: z.number(),
  type: adminSpotTypeSchema,
  description: z.string().nullable(),
  meetups_count: z.number(),
})
export type AdminSpot = z.infer<typeof adminSpotSchema>

/**
 * Prüft eine Koordinate: nicht leer, eine Zahl, im gültigen Bereich. Gesetzt wird sie im UI über die
 * Karte (`SpotLocationPicker`), nicht getippt — die Meldung spricht deshalb vom Setzen, und der
 * Bereich ist nur noch ein Netz gegen Werte, die gar nicht erst entstehen sollten.
 */
function coordinate(max: number, message: string) {
  return z.string().refine((value) => {
    const parsed = Number(value)
    return value.trim() !== '' && Number.isFinite(parsed) && parsed >= -max && parsed <= max
  }, message)
}

/**
 * Startplatz-**Formular** (RHF). Zahlen bleiben Strings — ein `<input>` liefert nun mal Strings, und
 * das ist bereits das Muster von `profileEditInputSchema` (`flight_hours: z.string()`). Umgerechnet
 * wird beim Absenden, siehe {@link AdminSpotPayload}.
 */
export const adminSpotInputSchema = z.object({
  name: z.string().min(2, 'Mindestens 2 Zeichen.').max(150, 'Höchstens 150 Zeichen.'),
  region: z.string().min(1, 'Bitte eine Region angeben.').max(80, 'Höchstens 80 Zeichen.'),
  country: z.string().length(2, 'Bitte den 2-stelligen Ländercode angeben (z. B. DE).'),
  lat: coordinate(90, 'Bitte den Startplatz auf der Karte setzen.'),
  lng: coordinate(180, 'Bitte den Startplatz auf der Karte setzen.'),
  type: adminSpotTypeSchema,
  description: z.string().max(2000, 'Höchstens 2000 Zeichen.'),
})
export type AdminSpotInput = z.infer<typeof adminSpotInputSchema>

/** Was tatsächlich über die Leitung geht (Koordinaten als Zahl, leere Beschreibung als null). */
export type AdminSpotPayload = {
  name: string
  region: string
  country: string
  lat: number
  lng: number
  type: AdminSpotType
  description: string | null
}

export const adminStatsSchema = z.object({
  users: z.object({
    total: z.number(),
    active: z.number(),
    suspended: z.number(),
    deleted: z.number(),
    admins: z.number(),
    new_7d: z.number(),
  }),
  meetups: z.object({
    total: z.number(),
    upcoming: z.number(),
    cancelled: z.number(),
  }),
  groups: z.object({
    total: z.number(),
    active: z.number(),
    deleted: z.number(),
    private: z.number(),
  }),
  spots: z.object({
    total: z.number(),
  }),
})
export type AdminStats = z.infer<typeof adminStatsSchema>
