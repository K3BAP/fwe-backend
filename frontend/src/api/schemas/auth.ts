import { z } from 'zod'
import { ownProfileSchema } from './profiles'

/** Auth-Ein-/Ausgaben (API.md §2). Eingabe-Schemas treiben zugleich die RHF-Validierung. */

export const loginInputSchema = z.object({
  email: z.email('Bitte eine gültige E-Mail angeben.'),
  password: z.string().min(8, 'Mindestens 8 Zeichen.'),
})
export type LoginInput = z.infer<typeof loginInputSchema>

export const registerInputSchema = z.object({
  display_name: z.string().min(2, 'Mindestens 2 Zeichen.').max(80, 'Höchstens 80 Zeichen.'),
  email: z.email('Bitte eine gültige E-Mail angeben.'),
  password: z.string().min(8, 'Mindestens 8 Zeichen.'),
  // Pflicht: Nutzer werden über den Benutzernamen gefunden (Verzeichnis/@-Suche).
  handle: z
    .string()
    .min(1, 'Bitte einen Benutzernamen angeben.')
    .regex(/^[a-z0-9_]{3,30}$/, 'Nur a–z, 0–9, _ (3–30 Zeichen).'),
})
export type RegisterInput = z.infer<typeof registerInputSchema>

/** UI-Session-Spiegel (entspricht dem authStore-SessionUser). In M2 aus `PublicUser` gemappt. */
export const sessionUserSchema = z.object({
  id: z.number(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
})
export type SessionUserDto = z.infer<typeof sessionUserSchema>

/** Wire-DTO „öffentlicher Nutzer" (das `user`-Objekt in Auth-Antworten, API.md §2). */
export const publicUserSchema = z.object({
  id: z.number(),
  display_name: z.string(),
  handle: z.string().nullable(),
  avatar_path: z.string().nullable(),
})
export type PublicUser = z.infer<typeof publicUserSchema>

/**
 * Antwort von `GET /auth/me` (mit `unread`) sowie `POST /auth/login|register` (ohne `unread`).
 * Wird im Auth-Hook auf den schlanken `SessionUser` des Stores reduziert.
 */
export const authSessionSchema = z.object({
  user: publicUserSchema,
  profile: ownProfileSchema,
  is_admin: z.boolean().default(false), // Plattform-Admin (Shield-Gruppe): steuert Badge + /admin-Guard; durchgesetzt serverseitig (admin-Filter, ADR-019)
  unread: z.object({ messages: z.number(), notifications: z.number() }).optional(),
})
export type AuthSession = z.infer<typeof authSessionSchema>
