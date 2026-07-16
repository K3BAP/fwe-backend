import { useQuery } from '@tanstack/react-query'
import { USE_MOCKS } from '@/config'
import { briefingTable } from '@/mocks/briefing'
import { mockRead } from '@/mocks/runtime'
import { apiFetch } from './http'
import { qk } from './queryKeys'
import { meetupBriefingSchema, type MeetupBriefing } from './schemas'

/** Deckt sich mit dem 30-min-Server-Cache (ADR-018) — früher neu zu fragen wäre verschenkt. */
const BRIEFING_STALE_TIME = 30 * 60 * 1000

async function fetchMeetupBriefing(meetupId: number, startsAt: string): Promise<MeetupBriefing> {
  if (USE_MOCKS.briefing) return mockRead(() => briefingTable.forMeetup(meetupId, startsAt))
  return apiFetch(`/meetups/${meetupId}/briefing`, meetupBriefingSchema)
}

/**
 * KI-Flug-Briefing (`GET /meetups/{id}/briefing`). Läuft nur auf ausdrücklichen Klick
 * (`enabled`), denn jeder Erstabruf kann Gemini-Frei-Kontingent kosten; `retry: 0` aus dem
 * gleichen Grund — der erneute Klick auf den Button ist der manuelle Retry.
 */
export function useMeetupBriefing(meetupId: number, startsAt: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.meetups.briefing(meetupId),
    queryFn: () => fetchMeetupBriefing(meetupId, startsAt),
    enabled,
    staleTime: BRIEFING_STALE_TIME,
    retry: 0,
  })
}
