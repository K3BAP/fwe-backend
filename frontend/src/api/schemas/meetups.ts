import { z } from 'zod'
import { experienceLevelSchema, publicUserCardSchema } from './common'

/** Flugtreffen-DTOs (API.md §5, DATA_MODEL §4). */

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

export const spotListSchema = z.array(spotSchema)

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

/** Detail-Projektion: Listenfelder + Beschreibung, Teilnehmer und nutzerbezogene Flags. */
export const meetupDetailSchema = meetupListItemSchema.extend({
  spot_id: z.number(),
  creator_user_id: z.number(),
  description: z.string().nullable(),
  participants: z.array(publicUserCardSchema),
  is_participant: z.boolean(),
  can_edit: z.boolean(),
})
export type MeetupDetail = z.infer<typeof meetupDetailSchema>

/** Eingabe für „Treffen erstellen/bearbeiten" (API.md §5.3). */
export const meetupCreateInputSchema = z.object({
  title: z.string().min(3, 'Mindestens 3 Zeichen.').max(150, 'Höchstens 150 Zeichen.'),
  spot_id: z.number({ error: 'Bitte einen Startplatz wählen.' }).int().positive('Bitte einen Startplatz wählen.'),
  starts_at: z.string().min(1, 'Bitte Datum und Uhrzeit angeben.'),
  experience_level: experienceLevelSchema,
  max_participants: z.number().int().min(1, 'Mindestens 1 Platz.').nullable(),
  description: z.string().max(5000, 'Höchstens 5000 Zeichen.').nullable(),
})
export type MeetupCreateInput = z.infer<typeof meetupCreateInputSchema>
