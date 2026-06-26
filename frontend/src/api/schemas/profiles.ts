import { z } from 'zod'

/** Profil-DTOs (API.md §3, ADR-010/012). Erfahrungslevel hier ohne „all" (Teilmenge). */

export const pilotExperienceSchema = z.enum(['beginner', 'advanced', 'expert'])
export type PilotExperience = z.infer<typeof pilotExperienceSchema>

/** Profil-Ansicht (eigene + fremde). `is_self` steuert Bearbeiten vs. Direktchat. */
export const profileSchema = z.object({
  user_id: z.number(),
  display_name: z.string(),
  handle: z.string().nullable(),
  avatar_path: z.string().nullable(),
  bio: z.string().nullable(),
  experience_level: pilotExperienceSchema.nullable(),
  license_class: z.string().nullable(),
  glider: z.string().nullable(),
  home_region: z.string().nullable(),
  flight_hours: z.number().nullable(),
  created_at: z.string(),
  is_self: z.boolean(),
})
export type Profile = z.infer<typeof profileSchema>

/** Eingabe für „Profil bearbeiten". `avatar_path` optional (Mock-Object-URL). */
export const profileEditInputSchema = z.object({
  display_name: z.string().min(2, 'Mindestens 2 Zeichen.').max(80, 'Höchstens 80 Zeichen.'),
  handle: z.union([z.literal(''), z.string().regex(/^[a-z0-9_]{3,30}$/, 'Nur a–z, 0–9, _ (3–30 Zeichen).')]).optional(),
  bio: z.string().max(2000, 'Höchstens 2000 Zeichen.'),
  experience_level: z.union([pilotExperienceSchema, z.literal('')]),
  license_class: z.string(),
  glider: z.string(),
  home_region: z.string(),
  flight_hours: z.string(),
  avatar_path: z.string().nullable().optional(),
})
export type ProfileEditInput = z.infer<typeof profileEditInputSchema>
