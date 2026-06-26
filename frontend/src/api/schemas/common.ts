import { z } from 'zod'

/**
 * Domänenübergreifende DTO-Bausteine (ADR-003, API.md). Werden vom Barrel `@/api/schemas`
 * re-exportiert — Importpfade in der App bleiben dadurch stabil.
 */

/** Erfahrungslevel — für Treffen-Filter (inkl. „all"). Profile nutzen die 3-Wert-Teilmenge. */
export const experienceLevelSchema = z.enum(['beginner', 'advanced', 'expert', 'all'])
export type ExperienceLevel = z.infer<typeof experienceLevelSchema>

/** Reduzierte Nutzer-Projektion für Listen, Avatare & Teilnehmer (API.md, „PublicUserCard"). */
export const publicUserCardSchema = z.object({
  id: z.number(),
  display_name: z.string(),
  handle: z.string().nullable(),
  avatar_path: z.string().nullable(),
})
export type PublicUserCard = z.infer<typeof publicUserCardSchema>

/** Aggregierte Emoji-Reaktion (Feed-Posts & Chat-Nachrichten, ADR-009). `me` = hat selbst reagiert. */
export const reactionSchema = z.object({
  emoji: z.string(),
  count: z.number(),
  me: z.boolean(),
})
export type Reaction = z.infer<typeof reactionSchema>

/** Standard-Pagination-Block der Listen-Endpunkte. */
export const paginationSchema = z.object({
  page: z.number(),
  perPage: z.number(),
  total: z.number(),
})
export type Pagination = z.infer<typeof paginationSchema>
