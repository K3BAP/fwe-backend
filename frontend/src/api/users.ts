import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { USE_MOCKS } from '@/config'
import { usersTable } from '@/mocks/users'
import { mockRead } from '@/mocks/runtime'
import { apiFetch } from './http'
import { qk } from './queryKeys'
import { publicUserCardSchema, type PublicUserCard } from './schemas'

/** Pilot-Verzeichnis (für @-Suche / gerichtete Einladungen). M1 aus dem Mock-Store, ab M2 `GET /users`. */
async function fetchUsers(): Promise<PublicUserCard[]> {
  if (USE_MOCKS.profile) return mockRead(() => usersTable.list(), { emptyValue: [] })
  return apiFetch('/users', z.array(publicUserCardSchema))
}

export function useUsers() {
  return useQuery({ queryKey: qk.users, queryFn: fetchUsers, staleTime: Infinity })
}
