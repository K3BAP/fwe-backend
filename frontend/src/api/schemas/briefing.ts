import { z } from 'zod'

/**
 * KI-Flug-Briefing zu einem Flugtreffen (ADR-018, Quelle: Gemini hinter unserem Backend-Proxy).
 * Wie beim Wetter ist Nicht-Verfügbarkeit **Datum, kein Fehler**: die Wetter-Gründe werden
 * durchgereicht, `not_configured` bedeutet „kein API-Key auf diesem Server" — die App läuft
 * dann unverändert weiter. Der Text beschreibt nur die Daten, nie eine Flugfreigabe.
 */
export const meetupBriefingSchema = z.object({
  available: z.boolean(),
  reason: z.enum(['past', 'out_of_range', 'no_location', 'not_configured']).nullable(),
  text: z.string().nullable(), // 2–3 deutsche Sätze
  generated_at: z.string().nullable(), // ISO-8601 (UTC)
})
export type MeetupBriefing = z.infer<typeof meetupBriefingSchema>
