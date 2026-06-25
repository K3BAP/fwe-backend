import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { USE_MOCKS } from '@/config'
import { sessionMock } from '@/mocks/session'
import { mockRead, mockWrite } from '@/mocks/runtime'
import { useAuthStore, type SessionUser } from '@/stores/authStore'
import { apiFetch } from './http'
import { qk } from './queryKeys'
import { sessionUserSchema, type LoginInput, type RegisterInput } from './schemas'

/**
 * Auth-Naht (ADR-016): in M1 gegen den Mock-Session-Store, in M2 (Auth verkabeln) auf echte
 * Shield-Endpunkte umgestellt. Der authStore spiegelt das `['me']`-Query.
 */
async function fetchMe(): Promise<SessionUser | null> {
  if (USE_MOCKS) return mockRead(() => sessionMock.me())
  // M2: GET /auth/me (OwnProfile) → SessionUser-Mapping an dieser Stelle.
  return apiFetch('/auth/me', sessionUserSchema)
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
      if (USE_MOCKS) return mockWrite(() => sessionMock.login())
      return apiFetch('/auth/login', sessionUserSchema, { method: 'POST', body: input })
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
      if (USE_MOCKS) return mockWrite(() => sessionMock.login())
      return apiFetch('/auth/register', sessionUserSchema, { method: 'POST', body: input })
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
      if (USE_MOCKS) return mockWrite(() => sessionMock.logout())
      await apiFetch('/auth/logout', sessionUserSchema, { method: 'POST' })
    },
    onSuccess: () => {
      clear()
      qc.setQueryData(qk.me, null)
    },
  })
}
