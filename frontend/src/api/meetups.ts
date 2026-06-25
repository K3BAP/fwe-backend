import { useQuery } from '@tanstack/react-query'
import { MOCK_LATENCY, USE_MOCKS } from '@/config'
import { MOCK_MEETUPS } from '@/mocks/meetups'
import { apiFetch } from './http'
import { qk } from './queryKeys'
import { meetupListSchema, type MeetupListItem } from './schemas'

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Daten-Naht (ADR-016): in M1 aus Mocks, ab M3 (Flugtreffen verkabeln) auf `apiFetch` umgestellt —
 * nur diese Funktion ändert sich, die Hooks/Komponenten bleiben gleich.
 */
async function fetchMeetups(): Promise<MeetupListItem[]> {
  if (USE_MOCKS) {
    await delay(MOCK_LATENCY)
    return MOCK_MEETUPS
  }
  return apiFetch('/meetups', meetupListSchema)
}

export function useMeetups() {
  return useQuery({ queryKey: qk.meetups.list(), queryFn: fetchMeetups })
}
