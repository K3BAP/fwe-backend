import { z } from 'zod'

/**
 * Zod-DTO-Schemas = Single Source of Truth für die Typen über die API-Grenze (ADR-003, API.md).
 * `z.infer` liefert die TypeScript-Typen; dieselben Schemas validieren echte Responses (api/http).
 */

export const experienceLevelSchema = z.enum(['beginner', 'advanced', 'expert', 'all'])
export type ExperienceLevel = z.infer<typeof experienceLevelSchema>

/** Abgeleiteter Treffen-Status (im Read berechnet, DATA_MODEL §4.2.1). */
export const meetupStatusSchema = z.enum(['open', 'full', 'cancelled', 'finished'])
export type MeetupStatus = z.infer<typeof meetupStatusSchema>

export const spotSchema = z.object({
  id: z.number(),
  name: z.string(),
  region: z.string(),
  lat: z.number(),
  lng: z.number(),
})
export type Spot = z.infer<typeof spotSchema>

/** Listen-Projektion eines Flugtreffens (Karte/Tabelle/Cards). */
export const meetupListItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  spot_name: z.string(),
  region: z.string(),
  starts_at: z.string(), // ISO-8601
  experience_level: experienceLevelSchema,
  participant_count: z.number(),
  max_participants: z.number().nullable(),
  free_spots: z.number().nullable(),
  derived_status: meetupStatusSchema,
  lat: z.number().nullable(),
  lng: z.number().nullable(),
})
export type MeetupListItem = z.infer<typeof meetupListItemSchema>

export const meetupListSchema = z.array(meetupListItemSchema)

export const paginationSchema = z.object({
  page: z.number(),
  perPage: z.number(),
  total: z.number(),
})
export type Pagination = z.infer<typeof paginationSchema>
