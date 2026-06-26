import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { USE_MOCKS } from '@/config'
import { profilesTable } from '@/mocks/profiles'
import { mockRead, mockWrite } from '@/mocks/runtime'
import { useAuthStore } from '@/stores/authStore'
import { apiFetch } from './http'
import { qk } from './queryKeys'
import {
  avatarUploadSchema,
  ownProfileSchema,
  publicProfileSchema,
  type OwnProfile,
  type Profile,
  type ProfileEditInput,
  type PublicProfile,
} from './schemas'

/**
 * Profil-Naht (ADR-016): in M1 aus dem Mock-Store, ab M2 (Slice 3) gegen das echte Profile-Backend.
 * Das Backend liefert spec-treue Wire-DTOs (`PublicProfile`/`OwnProfile`, API.md §3); hier werden sie auf
 * das unveränderte `Profile`-View-Model gemappt (`bio_markdown→bio`, `is_self` aus der Session), damit
 * die Komponenten gleich bleiben.
 */
function publicToProfile(p: PublicProfile, isSelf: boolean): Profile {
  return {
    user_id: p.user_id,
    display_name: p.display_name,
    handle: p.handle,
    avatar_path: p.avatar_path,
    bio: p.bio_markdown,
    experience_level: p.experience_level,
    license_class: p.license_class ?? null,
    glider: p.glider ?? null,
    home_region: p.home_region ?? null,
    flight_hours: p.flight_hours ?? null,
    created_at: p.created_at,
    is_self: isSelf,
  }
}

function ownToProfile(o: OwnProfile): Profile {
  return {
    user_id: o.user_id,
    display_name: o.display_name,
    handle: o.handle,
    avatar_path: o.avatar_path,
    bio: o.bio_markdown,
    experience_level: o.experience_level,
    license_class: o.license_class,
    glider: o.glider,
    home_region: o.home_region,
    flight_hours: o.flight_hours,
    created_at: o.created_at,
    is_self: true,
  }
}

/** Formular-Eingabe → PATCH-Body (API.md §3.3): `bio→bio_markdown`, Leerstrings → `null`, Zahl casten. */
function toUpdateBody(input: ProfileEditInput) {
  const clean = (s: string): string | null => (s.trim() === '' ? null : s.trim())
  return {
    display_name: input.display_name,
    handle: clean(input.handle ?? ''),
    bio_markdown: clean(input.bio),
    experience_level: input.experience_level === '' ? null : input.experience_level,
    license_class: clean(input.license_class),
    glider: clean(input.glider),
    home_region: clean(input.home_region),
    flight_hours: input.flight_hours.trim() === '' ? null : Number(input.flight_hours),
  }
}

async function fetchProfile(userId: number): Promise<Profile> {
  if (USE_MOCKS.profile) return mockRead(() => profilesTable.get(userId))
  const meId = useAuthStore.getState().user?.id
  return publicToProfile(await apiFetch(`/users/${userId}`, publicProfileSchema), meId === userId)
}

export function useProfile(userId: number) {
  return useQuery({ queryKey: qk.profiles(userId), queryFn: () => fetchProfile(userId), enabled: Number.isFinite(userId) })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  const setFromMe = useAuthStore((s) => s.setFromMe)
  return useMutation({
    mutationFn: async (input: ProfileEditInput): Promise<Profile> => {
      if (USE_MOCKS.profile) return mockWrite(() => profilesTable.updateSelf(input))
      return ownToProfile(await apiFetch('/me/profile', ownProfileSchema, { method: 'PATCH', body: toUpdateBody(input) }))
    },
    onSuccess: (profile) => {
      qc.setQueryData(qk.profiles(profile.user_id), profile)
      // authStore spiegelt Name/Avatar (TopBar, eigene Nachrichten).
      setFromMe({ id: profile.user_id, displayName: profile.display_name, avatarUrl: profile.avatar_path })
    },
  })
}

/** Avatar hochladen (multipart, API.md §3.4). Aktualisiert Profil-Cache + authStore-Avatar. */
export function useUploadAvatar() {
  const qc = useQueryClient()
  const setFromMe = useAuthStore((s) => s.setFromMe)
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      if (USE_MOCKS.profile) return mockWrite(() => URL.createObjectURL(file))
      const form = new FormData()
      form.append('file', file)
      return (await apiFetch('/me/avatar', avatarUploadSchema, { method: 'POST', body: form })).avatar_path
    },
    onSuccess: (avatarPath) => {
      const me = useAuthStore.getState().user
      if (!me) return
      setFromMe({ ...me, avatarUrl: avatarPath })
      qc.setQueryData<Profile>(qk.profiles(me.id), (old) => (old ? { ...old, avatar_path: avatarPath } : old))
    },
  })
}
