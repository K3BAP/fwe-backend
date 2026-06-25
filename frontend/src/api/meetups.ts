import { useQuery } from '@tanstack/react-query'
import { USE_MOCKS } from '@/config'
import { meetupsTable } from '@/mocks/meetups'
import { mockRead } from '@/mocks/runtime'
import { apiFetch } from './http'
import { qk } from './queryKeys'
import { meetupListSchema, type MeetupListItem } from './schemas'

/**
 * Daten-Naht (ADR-016): in M1 aus dem Mock-Store, ab M3 (Flugtreffen verkabeln) auf `apiFetch`
 * umgestellt — nur diese Funktion ändert sich, Hooks/Komponenten bleiben gleich.
 */
async function fetchMeetups(): Promise<MeetupListItem[]> {
  if (USE_MOCKS) return mockRead(() => meetupsTable.list(), { emptyValue: [] })
  return apiFetch('/meetups', meetupListSchema)
}

export function useMeetups() {
  return useQuery({ queryKey: qk.meetups.list(), queryFn: fetchMeetups })
}
