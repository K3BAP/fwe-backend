import { describe, it, expect } from 'vitest'
import { meetupWeatherSchema, weatherHourSchema } from './weather'

const hour = {
  at: '2026-07-12T10:00:00Z',
  temperature_c: 21.5,
  wind_speed_kmh: 12.4,
  wind_gusts_kmh: 18.9,
  wind_direction_deg: 225,
  precipitation_probability_pct: 10,
  precipitation_mm: 0,
  cloud_cover_pct: 40,
  weather_code: 2,
  wind_1500m_kmh: 24,
  wind_1500m_direction_deg: 240,
  cape_j_kg: 350,
}

describe('weather schemas (API-Vertrag)', () => {
  it('weatherHour macht einen Round-Trip', () => {
    expect(weatherHourSchema.parse(hour)).toEqual(hour)
  })

  it('weatherHour lässt Modell-Lücken zu (850 hPa, CAPE, Regenwahrscheinlichkeit)', () => {
    const sparse = { ...hour, wind_1500m_kmh: null, wind_1500m_direction_deg: null, cape_j_kg: null, precipitation_probability_pct: null }
    expect(weatherHourSchema.parse(sparse)).toEqual(sparse)
  })

  it('weatherHour verwirft eine Stunde ohne Bodenwind', () => {
    const withoutWind: Record<string, unknown> = { ...hour }
    delete withoutWind.wind_speed_kmh
    expect(weatherHourSchema.safeParse(withoutWind).success).toBe(false)
  })

  it('meetupWeather akzeptiert die vorhandene Vorhersage', () => {
    const dto = { available: true, reason: null, is_current: false, snapshot: hour, trend: [hour] }
    expect(meetupWeatherSchema.parse(dto)).toEqual(dto)
  })

  it('meetupWeather akzeptiert „kein Wetter" samt Grund', () => {
    const dto = { available: false, reason: 'out_of_range', is_current: false, snapshot: null, trend: [] }
    expect(meetupWeatherSchema.parse(dto)).toEqual(dto)
  })

  it('meetupWeather verwirft einen unbekannten Grund', () => {
    const dto = { available: false, reason: 'rainy', is_current: false, snapshot: null, trend: [] }
    expect(meetupWeatherSchema.safeParse(dto).success).toBe(false)
  })
})
