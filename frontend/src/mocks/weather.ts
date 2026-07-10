import type { MeetupWeather, WeatherHour } from '@/api/schemas'

/**
 * Mock-Wetter der Daten-Naht (ADR-016). Deterministisch aus der Meetup-ID abgeleitet, damit die
 * Detailseite bei jedem Reload dasselbe zeigt. `id % 3` wählt eine Wetterlage, sodass sich alle
 * Wind-Farbstufen (ruhig / kräftig / gewittrig) im Prototyp durchspielen lassen.
 */

/** Kleiner deterministischer LCG (numerical recipes) — kein `Math.random` im Mock. */
function seeded(seed: number): () => number {
  let state = (seed * 1664525 + 1013904223) >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

type Regime = {
  wind: number
  gusts: number
  code: number
  cloud: number
  rainPct: number
  rainMm: number
  cape: number
}

const REGIMES: Regime[] = [
  { wind: 9, gusts: 14, code: 0, cloud: 12, rainPct: 0, rainMm: 0, cape: 320 }, // ruhig, klar
  { wind: 24, gusts: 34, code: 3, cloud: 82, rainPct: 20, rainMm: 0, cape: 60 }, // kräftig, bedeckt
  { wind: 16, gusts: 29, code: 95, cloud: 74, rainPct: 70, rainMm: 1.6, cape: 1450 }, // gewittrig
]

function hourAt(iso: string, regime: Regime, rand: () => number, offset: number): WeatherHour {
  const at = new Date(iso)
  at.setUTCMinutes(0, 0, 0)
  at.setUTCHours(at.getUTCHours() + offset)

  // Wind zieht über den Nachmittag leicht an — der Trend soll eine Entwicklung zeigen, kein Rauschen.
  const drift = offset * 1.4
  const jitter = (spread: number) => (rand() - 0.5) * spread

  return {
    at: at.toISOString(),
    temperature_c: Math.round((21 + drift * 0.3 + jitter(2)) * 10) / 10,
    wind_speed_kmh: Math.round(Math.max(0, regime.wind + drift + jitter(3)) * 10) / 10,
    wind_gusts_kmh: Math.round(Math.max(0, regime.gusts + drift * 1.3 + jitter(4)) * 10) / 10,
    wind_direction_deg: Math.round(200 + jitter(60)),
    precipitation_probability_pct: regime.rainPct,
    precipitation_mm: regime.rainMm,
    cloud_cover_pct: regime.cloud,
    weather_code: regime.code,
    wind_1500m_kmh: Math.round((regime.wind * 1.9 + jitter(4)) * 10) / 10,
    wind_1500m_direction_deg: Math.round(215 + jitter(40)),
    cape_j_kg: regime.cape,
  }
}

export const weatherTable = {
  forMeetup(meetupId: number, startsAt: string): MeetupWeather {
    const start = new Date(startsAt)
    if (start.getTime() < Date.now() - 2 * 3600_000) {
      return { available: false, reason: 'past', is_current: false, snapshot: null, trend: [] }
    }

    const rand = seeded(meetupId)
    const regime = REGIMES[meetupId % REGIMES.length]
    const trend = [-2, -1, 0, 1, 2, 3].map((offset) => hourAt(startsAt, regime, rand, offset))

    return { available: true, reason: null, is_current: false, snapshot: trend[2], trend }
  },
}
