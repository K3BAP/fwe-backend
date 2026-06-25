import { z } from 'zod'

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
  handle: z
    .union([z.literal(''), z.string().regex(/^[a-z0-9_]{3,30}$/, 'Nur a–z, 0–9, _ (3–30 Zeichen).')])
    .optional(),
})
export type RegisterInput = z.infer<typeof registerInputSchema>

/** UI-Session-Spiegel (entspricht dem authStore-SessionUser). In M2 aus OwnProfile gemappt. */
export const sessionUserSchema = z.object({
  id: z.number(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
})
export type SessionUserDto = z.infer<typeof sessionUserSchema>
