import { z } from 'zod'
import { experienceLevelSchema, type MeetupCreateInput, type MeetupDetail } from '@/api/schemas'

/**
 * Formular-Schema für Erstellen **und** Bearbeiten. Datum und Uhrzeit stehen getrennt im Formular
 * (zwei native Felder) und werden erst beim Absenden zu `starts_at` zusammengeführt.
 */
export const meetupFormSchema = z.object({
  title: z.string().min(3, 'Mindestens 3 Zeichen.').max(150, 'Höchstens 150 Zeichen.'),
  spot_id: z.number().int().positive('Bitte einen Startplatz wählen.'),
  date: z.string().min(1, 'Bitte ein Datum wählen.'),
  time: z.string().min(1, 'Bitte eine Uhrzeit wählen.'),
  experience_level: experienceLevelSchema,
  max_participants: z.string(),
  description: z.string(),
})
export type MeetupFormValues = z.infer<typeof meetupFormSchema>

/** Zerlegt einen ISO-Zeitstempel in lokale Datums- (YYYY-MM-DD) + Uhrzeit-Strings (HH:mm). */
function splitDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
}

/**
 * Startwerte des Formulars — ohne `meetup` ein leeres Erstellen-Formular.
 *
 * `spot_id: 0` heißt „noch keiner gewählt" und fällt durch die `positive()`-Regel. Das greift auch
 * für ein bestehendes Treffen, dessen Startplatz gelöscht wurde (`spot_id` ist dann `null`): Der
 * Rest bleibt bearbeitbar, gespeichert wird aber erst nach einer Neuwahl.
 */
export function meetupFormDefaults(meetup?: MeetupDetail): MeetupFormValues {
  const dt = meetup ? splitDateTime(meetup.starts_at) : null

  return {
    title: meetup?.title ?? '',
    spot_id: meetup?.spot_id ?? 0,
    date: dt?.date ?? '',
    time: dt?.time ?? '',
    experience_level: meetup?.experience_level ?? 'all',
    max_participants: meetup?.max_participants?.toString() ?? '',
    description: meetup?.description ?? '',
  }
}

/** Formular-Werte → Wire-Payload: leere Optionalfelder werden zu `null`, nicht zu `''`/`0`. */
export function toMeetupInput(values: MeetupFormValues): MeetupCreateInput {
  return {
    title: values.title,
    spot_id: values.spot_id,
    starts_at: new Date(`${values.date}T${values.time}`).toISOString(),
    experience_level: values.experience_level,
    max_participants: values.max_participants.trim() === '' ? null : Math.max(1, Number(values.max_participants) || 1),
    description: values.description.trim() === '' ? null : values.description,
  }
}
