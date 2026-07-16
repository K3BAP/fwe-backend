import { useQuery } from '@tanstack/react-query'
import { USE_MOCKS } from '@/config'
import { spotsTable } from '@/mocks/spots'
import { mockRead } from '@/mocks/runtime'
import { apiFetch } from './http'
import { qk } from './queryKeys'
import { spotListSchema, type Spot } from './schemas'

/**
 * Startplätze (öffentlich). In M1 aus dem Mock-Store, ab M3 via `GET /spots`. Quelle für den
 * Spot-Autocomplete; der Filter läuft client-seitig über diese kleine, statische Liste.
 */
async function fetchSpots(): Promise<Spot[]> {
  if (USE_MOCKS.meetups) return mockRead(() => spotsTable.list(), { emptyValue: [] })
  return apiFetch('/spots', spotListSchema)
}

export function useSpots() {
  return useQuery({ queryKey: qk.spots, queryFn: fetchSpots, staleTime: Infinity })
}
