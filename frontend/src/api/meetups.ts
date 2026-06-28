import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { USE_MOCKS } from '@/config'
import { meetupsTable } from '@/mocks/meetups'
import { mockRead, mockWrite } from '@/mocks/runtime'
import { useAuthStore, type SessionUser } from '@/stores/authStore'
import { toast } from '@/stores/toastStore'
import { ApiError, apiFetch, apiFetchPage } from './http'
import { qk } from './queryKeys'
import {
  meetupDetailSchema,
  meetupListItemSchema,
  type MeetupCreateInput,
  type MeetupDetail,
  type MeetupListItem,
  type PublicUserCard,
} from './schemas'

/** Serverseitige Such-/Filter-/Sort-/Pagination-Parameter für `GET /meetups` (02-flugtreffen.md §6). */
export type MeetupListParams = {
  q?: string
  region?: string
  level?: string
  status?: string
  date_from?: string
  date_to?: string
  has_free_spots?: string
  sort?: string
  limit?: number
  offset?: number
}

export type MeetupListPage = { items: MeetupListItem[]; total: number }

/**
 * Daten-Naht (ADR-016): in M1 aus dem Mock-Store, ab M3 (Flugtreffen verkabeln) gegen das echte
 * Backend — nur diese Funktionen ändern sich, Hooks/Komponenten bleiben gleich. Suche/Filter/Sort/
 * Pagination laufen serverseitig; `meta.total` speist den Pager.
 */
async function fetchMeetups(params: MeetupListParams): Promise<MeetupListPage> {
  if (USE_MOCKS.meetups) {
    const items = await mockRead(() => meetupsTable.list(), { emptyValue: [] })
    return { items, total: items.length }
  }
  const page = await apiFetchPage('/meetups', meetupListItemSchema, { query: params })
  return { items: page.items, total: page.total }
}

async function fetchMeetup(id: number): Promise<MeetupDetail> {
  if (USE_MOCKS.meetups) return mockRead(() => meetupsTable.detail(id))
  return apiFetch(`/meetups/${id}`, meetupDetailSchema)
}

export function useMeetups(params: MeetupListParams) {
  return useQuery({ queryKey: qk.meetups.list(params), queryFn: () => fetchMeetups(params) })
}

export function useMeetup(id: number) {
  return useQuery({ queryKey: qk.meetups.detail(id), queryFn: () => fetchMeetup(id), enabled: Number.isFinite(id) })
}

/** Session-User → PublicUserCard (für optimistische Teilnehmerliste). */
function meCard(user: SessionUser | null): PublicUserCard {
  return user
    ? { id: user.id, display_name: user.displayName, handle: null, avatar_path: user.avatarUrl }
    : { id: 0, display_name: 'Du', handle: null, avatar_path: null }
}

/** Patcht eine gecachte Detail-Projektion optimistisch (Teilnahme zu/absagen). */
function applyParticipation(d: MeetupDetail, me: PublicUserCard, joining: boolean): MeetupDetail {
  const has = d.participants.some((p) => p.id === me.id)
  const participants = joining
    ? has
      ? d.participants
      : [...d.participants, me]
    : d.participants.filter((p) => p.id !== me.id)
  const count = participants.length
  const locked = d.derived_status === 'cancelled' || d.derived_status === 'finished'
  return {
    ...d,
    participants,
    participant_count: count,
    free_spots: d.max_participants != null ? Math.max(0, d.max_participants - count) : null,
    is_participant: joining,
    derived_status: locked ? d.derived_status : d.max_participants != null && count >= d.max_participants ? 'full' : 'open',
  }
}

async function mutateParticipation(id: number, joining: boolean, user: PublicUserCard): Promise<MeetupDetail> {
  if (USE_MOCKS.meetups) return mockWrite(() => (joining ? meetupsTable.join(id, user) : meetupsTable.leave(id, user.id)))
  // Beitreten: POST .../participants; Austreten: DELETE .../participants/me (API.md §5.6/§5.7).
  const path = joining ? `/meetups/${id}/participants` : `/meetups/${id}/participants/me`
  return apiFetch(path, meetupDetailSchema, { method: joining ? 'POST' : 'DELETE' })
}

/** Teilnehmen/Absagen mit optimistischem Update + Rollback bei Fehler (z.B. 409 ausgebucht). */
function useParticipation(joining: boolean) {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  return useMutation({
    mutationFn: (id: number) => mutateParticipation(id, joining, meCard(user)),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.meetups.detail(id) })
      const prev = qc.getQueryData<MeetupDetail>(qk.meetups.detail(id))
      if (prev) qc.setQueryData(qk.meetups.detail(id), applyParticipation(prev, meCard(user), joining))
      return { prev }
    },
    onError: (err, id, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.meetups.detail(id), ctx.prev)
      toast.error(err instanceof ApiError && err.status === 409 ? err.message : 'Aktion fehlgeschlagen.')
    },
    onSuccess: (detail) => {
      qc.setQueryData(qk.meetups.detail(detail.id), detail)
      toast.success(joining ? 'Du bist dabei! 🪂' : 'Teilnahme abgesagt.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: [...qk.meetups.all, 'list'] }),
  })
}

export const useJoinMeetup = () => useParticipation(true)
export const useLeaveMeetup = () => useParticipation(false)

export function useCreateMeetup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: MeetupCreateInput): Promise<MeetupDetail> => {
      if (USE_MOCKS.meetups) return mockWrite(() => meetupsTable.create(input))
      return apiFetch('/meetups', meetupDetailSchema, { method: 'POST', body: input })
    },
    onSuccess: (detail) => {
      qc.setQueryData(qk.meetups.detail(detail.id), detail)
      qc.invalidateQueries({ queryKey: [...qk.meetups.all, 'list'] })
    },
  })
}

export function useUpdateMeetup(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: MeetupCreateInput): Promise<MeetupDetail> =>
      USE_MOCKS.meetups ? mockWrite(() => meetupsTable.update(id, input)) : apiFetch(`/meetups/${id}`, meetupDetailSchema, { method: 'PATCH', body: input }),
    onSuccess: (detail) => {
      qc.setQueryData(qk.meetups.detail(detail.id), detail)
      qc.invalidateQueries({ queryKey: [...qk.meetups.all, 'list'] })
    },
  })
}

export function useCancelMeetup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number): Promise<MeetupDetail> =>
      USE_MOCKS.meetups ? mockWrite(() => meetupsTable.cancel(id)) : apiFetch(`/meetups/${id}`, meetupDetailSchema, { method: 'PATCH', body: { status: 'cancelled' } }),
    onSuccess: (detail) => {
      qc.setQueryData(qk.meetups.detail(detail.id), detail)
      qc.invalidateQueries({ queryKey: [...qk.meetups.all, 'list'] })
      toast.success('Treffen abgesagt.')
    },
  })
}

export function useDeleteMeetup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      if (USE_MOCKS.meetups) {
        await mockWrite(() => meetupsTable.remove(id))
        return
      }
      await apiFetch(`/meetups/${id}`, meetupDetailSchema, { method: 'DELETE' }) // 204 → Schema ungenutzt
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...qk.meetups.all, 'list'] }),
  })
}

export function useRemoveParticipant(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: number): Promise<MeetupDetail> =>
      USE_MOCKS.meetups ? mockWrite(() => meetupsTable.removeParticipant(id, userId)) : apiFetch(`/meetups/${id}/participants/${userId}`, meetupDetailSchema, { method: 'DELETE' }),
    onSuccess: (detail) => {
      qc.setQueryData(qk.meetups.detail(detail.id), detail)
      qc.invalidateQueries({ queryKey: [...qk.meetups.all, 'list'] })
    },
  })
}
