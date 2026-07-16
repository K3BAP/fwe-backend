import { useQuery } from '@tanstack/react-query'
import { USE_MOCKS } from '@/config'
import { weatherTable } from '@/mocks/weather'
import { mockRead } from '@/mocks/runtime'
import { apiFetch } from './http'
import { qk } from './queryKeys'
import { meetupWeatherSchema, type MeetupWeather } from './schemas'

/** Vorhersage bleibt eine Viertelstunde frisch — das Backend cacht ohnehin 30 min (ADR-017). */
const WEATHER_STALE_TIME = 15 * 60 * 1000

async function fetchMeetupWeather(meetupId: number, startsAt: string): Promise<MeetupWeather> {
  if (USE_MOCKS.weather) return mockRead(() => weatherTable.forMeetup(meetupId, startsAt))
  return apiFetch(`/meetups/${meetupId}/weather`, meetupWeatherSchema)
}

/**
 * Wetter am Startplatz eines Treffens (`GET /meetups/{id}/weather`). Kein Polling — Vorhersagen
 * ändern sich stündlich, nicht sekündlich. Aufrufer rendern das Panel nur, wenn das Treffen
 * Koordinaten hat; ohne sie antwortet das Backend mit `no_location`.
 */
export function useMeetupWeather(meetupId: number, startsAt: string) {
  return useQuery({
    queryKey: qk.meetups.weather(meetupId),
    queryFn: () => fetchMeetupWeather(meetupId, startsAt),
    staleTime: WEATHER_STALE_TIME,
    retry: 1,
  })
}
