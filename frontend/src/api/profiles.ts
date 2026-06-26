import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { USE_MOCKS } from '@/config'
import { profilesTable } from '@/mocks/profiles'
import { mockRead, mockWrite } from '@/mocks/runtime'
import { useAuthStore } from '@/stores/authStore'
import { apiFetch } from './http'
import { qk } from './queryKeys'
import { profileSchema, type Profile, type ProfileEditInput } from './schemas'

/**
 * Profil-Naht (ADR-016): in M1 aus dem Mock-Store, ab M2 (Auth/Profile verkabeln) auf `apiFetch`.
 */
async function fetchProfile(userId: number): Promise<Profile> {
  if (USE_MOCKS) return mockRead(() => profilesTable.get(userId))
  return apiFetch(`/users/${userId}/profile`, profileSchema)
}

export function useProfile(userId: number) {
  return useQuery({ queryKey: qk.profiles(userId), queryFn: () => fetchProfile(userId), enabled: Number.isFinite(userId) })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  const setFromMe = useAuthStore((s) => s.setFromMe)
  return useMutation({
    mutationFn: (input: ProfileEditInput): Promise<Profile> =>
      USE_MOCKS ? mockWrite(() => profilesTable.updateSelf(input)) : apiFetch('/me/profile', profileSchema, { method: 'PATCH', body: input }),
    onSuccess: (profile) => {
      qc.setQueryData(qk.profiles(profile.user_id), profile)
      // authStore spiegelt Name/Avatar (TopBar, eigene Nachrichten).
      setFromMe({ id: profile.user_id, displayName: profile.display_name, avatarUrl: profile.avatar_path })
    },
  })
}
