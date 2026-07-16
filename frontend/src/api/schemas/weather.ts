import { z } from 'zod'

/**
 * Eine Stunde der Vorhersage am Startplatz (Quelle: Open-Meteo, ADR-017). Die Stundenachse ist UTC.
 * Für Gleitschirmflieger zählen zuerst **Bodenwind (10 m)** und **Böen**; Höhenwind (850 hPa ≈ 1500 m)
 * und CAPE (Thermik) liefern nicht alle Modelle und sind darum nullable — ebenso die Regenwahrscheinlichkeit.
 */
export const weatherHourSchema = z.object({
  at: z.string(), // ISO-8601 (UTC)
  temperature_c: z.number(),
  wind_speed_kmh: z.number(),
  wind_gusts_kmh: z.number(),
  wind_direction_deg: z.number(),
  precipitation_probability_pct: z.number().nullable(),
  precipitation_mm: z.number(),
  cloud_cover_pct: z.number(),
  weather_code: z.number(), // WMO
  wind_1500m_kmh: z.number().nullable(),
  wind_1500m_direction_deg: z.number().nullable(),
  cape_j_kg: z.number().nullable(),
})
export type WeatherHour = z.infer<typeof weatherHourSchema>

/**
 * Wetter zu einem Flugtreffen. Fehlendes Wetter ist **Datum, kein Fehler**: `available: false` mit
 * `reason` (vergangenes Treffen, jenseits des 16-Tage-Horizonts, Treffen ohne Koordinaten).
 * `is_current` unterscheidet Ist-Wetter (Treffen läuft) von der Prognose zur Startzeit.
 */
export const meetupWeatherSchema = z.object({
  available: z.boolean(),
  reason: z.enum(['past', 'out_of_range', 'no_location']).nullable(),
  is_current: z.boolean(),
  snapshot: weatherHourSchema.nullable(),
  trend: z.array(weatherHourSchema),
})
export type MeetupWeather = z.infer<typeof meetupWeatherSchema>
