import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { USE_MOCKS } from '@/config'
import { sessionMock } from '@/mocks/session'
import { mockRead, mockWrite } from '@/mocks/runtime'
import { useAuthStore, type SessionUser } from '@/stores/authStore'
import { ApiError, apiFetch } from './http'
import { qk } from './queryKeys'
import { authSessionSchema, type AuthSession, type LoginInput, type RegisterInput } from './schemas'

/**
 * Auth-Naht (ADR-016): in M1 gegen den Mock-Session-Store, ab M2 (Auth verkabelt) auf echte
 * Shield-Endpunkte. Das Backend liefert `{ user, profile, unread? }` (API.md §2); hier wird das auf den
 * schlanken `SessionUser` des Stores reduziert, damit Komponenten unverändert bleiben. Der authStore
 * spiegelt das `['me']`-Query.
 */
function toSessionUser(s: AuthSession): SessionUser {
  return { id: s.user.id, displayName: s.user.display_name, avatarUrl: s.user.avatar_path }
}

async function fetchMe(): Promise<SessionUser | null> {
  if (USE_MOCKS.auth) return mockRead(() => sessionMock.me())
  try {
    return toSessionUser(await apiFetch('/auth/me', authSessionSchema))
  } catch (e) {
    // Keine/abgelaufene Session → Gast (kein Fehlerzustand, sondern „nicht eingeloggt").
    if (e instanceof ApiError && e.status === 401) return null
    throw e
  }
}

/** Lädt die Session und spiegelt sie in den authStore (einmal beim App-Start, siehe App.tsx). */
export function useMe() {
  const setFromMe = useAuthStore((s) => s.setFromMe)
  const query = useQuery({ queryKey: qk.me, queryFn: fetchMe, staleTime: Infinity, retry: false })
  useEffect(() => {
    if (query.isSuccess) setFromMe(query.data)
  }, [query.isSuccess, query.data, setFromMe])
  return query
}

export function useLogin() {
  const qc = useQueryClient()
  const setFromMe = useAuthStore((s) => s.setFromMe)
  return useMutation({
    mutationFn: async (input: LoginInput): Promise<SessionUser> => {
      if (USE_MOCKS.auth) return mockWrite(() => sessionMock.login())
      return toSessionUser(await apiFetch('/auth/login', authSessionSchema, { method: 'POST', body: input }))
    },
    onSuccess: (user) => {
      setFromMe(user)
      qc.setQueryData(qk.me, user)
    },
  })
}

export function useRegister() {
  const qc = useQueryClient()
  const setFromMe = useAuthStore((s) => s.setFromMe)
  return useMutation({
    mutationFn: async (input: RegisterInput): Promise<SessionUser> => {
      if (USE_MOCKS.auth) return mockWrite(() => sessionMock.login())
      return toSessionUser(await apiFetch('/auth/register', authSessionSchema, { method: 'POST', body: input }))
    },
    onSuccess: (user) => {
      setFromMe(user)
      qc.setQueryData(qk.me, user)
    },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  const clear = useAuthStore((s) => s.clear)
  return useMutation({
    mutationFn: async (): Promise<void> => {
      if (USE_MOCKS.auth) return mockWrite(() => sessionMock.logout())
      await apiFetch('/auth/logout', authSessionSchema, { method: 'POST' })
    },
    onSuccess: () => {
      clear()
      qc.setQueryData(qk.me, null)
    },
  })
}
