import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/stores/toastStore'
import { apiFetch, apiFetchPage } from './http'
import { qk } from './queryKeys'
import {
  adminGroupRowSchema,
  adminMeetupRowSchema,
  adminSpotSchema,
  adminStatsSchema,
  adminUserDetailSchema,
  adminUserRowSchema,
  type AdminGroupRow,
  type AdminMeetupRow,
  type AdminSpot,
  type AdminSpotPayload,
  type AdminStats,
  type AdminUserDetail,
  type AdminUserInput,
  type AdminUserRow,
} from './schemas'

/**
 * Admin-Bereich (ADR-019).
 *
 * **Ohne Mock-Store, bewusst:** die Naht aus ADR-016 existiert, damit das UI *vor* dem Backend gebaut
 * werden konnte (M1 → M2–M5). Diese Domäne entstand backend-first, alle `USE_MOCKS`-Flags stehen längst
 * auf `false` — ein `USE_MOCKS.admin` samt Mock-Store wäre Code, den kein Pfad je erreicht (und damit
 * ein ADR-013-Verstoß). Die *wertvolle* Hälfte der Naht, der typisierte DTO-Vertrag, steckt vollständig
 * in `api/schemas/admin.ts`.
 */

export type AdminUserListParams = { q?: string; status?: string; sort?: string; limit?: number; offset?: number }
export type AdminMeetupListParams = { q?: string; region?: string; status?: string; sort?: string; limit?: number; offset?: number }
export type AdminGroupListParams = { q?: string; visibility?: string; status?: string; sort?: string; limit?: number; offset?: number }
export type AdminSpotListParams = { q?: string; region?: string; type?: string; sort?: string; limit?: number; offset?: number }

export type Page<T> = { items: T[]; total: number }

// ──────────────────────────── Lesen ────────────────────────────

export function useAdminStats() {
  return useQuery({ queryKey: qk.admin.stats, queryFn: (): Promise<AdminStats> => apiFetch('/admin/stats', adminStatsSchema) })
}

export function useAdminUsers(params: AdminUserListParams) {
  return useQuery({
    queryKey: qk.admin.users.list(params),
    queryFn: async (): Promise<Page<AdminUserRow>> => {
      const page = await apiFetchPage('/admin/users', adminUserRowSchema, { query: params })
      return { items: page.items, total: page.total }
    },
  })
}

export function useAdminUser(id: number) {
  return useQuery({
    queryKey: qk.admin.users.detail(id),
    queryFn: (): Promise<AdminUserDetail> => apiFetch(`/admin/users/${id}`, adminUserDetailSchema),
    enabled: Number.isFinite(id),
  })
}

export function useAdminMeetups(params: AdminMeetupListParams) {
  return useQuery({
    queryKey: qk.admin.meetups(params),
    queryFn: async (): Promise<Page<AdminMeetupRow>> => {
      const page = await apiFetchPage('/admin/meetups', adminMeetupRowSchema, { query: params })
      return { items: page.items, total: page.total }
    },
  })
}

export function useAdminGroups(params: AdminGroupListParams) {
  return useQuery({
    queryKey: qk.admin.groups(params),
    queryFn: async (): Promise<Page<AdminGroupRow>> => {
      const page = await apiFetchPage('/admin/groups', adminGroupRowSchema, { query: params })
      return { items: page.items, total: page.total }
    },
  })
}

export function useAdminSpots(params: AdminSpotListParams) {
  return useQuery({
    queryKey: qk.admin.spots(params),
    queryFn: async (): Promise<Page<AdminSpot>> => {
      const page = await apiFetchPage('/admin/spots', adminSpotSchema, { query: params })
      return { items: page.items, total: page.total }
    },
  })
}

// ──────────────────────────── Benutzer schreiben ────────────────────────────

/**
 * Nach jedem Nutzer-Schreibvorgang: Admin-Liste + Kennzahlen, **und** die öffentlichen Keys — sonst
 * zeigen Piloten-Verzeichnis und Profilseite noch die alten Daten.
 */
function useUserInvalidation() {
  const qc = useQueryClient()
  return (detail: AdminUserDetail) => {
    qc.setQueryData(qk.admin.users.detail(detail.id), detail)
    qc.invalidateQueries({ queryKey: qk.admin.users.all })
    qc.invalidateQueries({ queryKey: qk.admin.stats })
    qc.invalidateQueries({ queryKey: qk.users })
    qc.invalidateQueries({ queryKey: qk.profiles(detail.id) })
    // Bearbeitet der Admin sich selbst, spiegelt der authStore Name/Avatar — sonst bliebe die TopBar alt.
    if (detail.is_self) qc.invalidateQueries({ queryKey: qk.me })
  }
}

export function useUpdateAdminUser(id: number) {
  const invalidate = useUserInvalidation()
  return useMutation({
    mutationFn: (input: AdminUserInput): Promise<AdminUserDetail> =>
      apiFetch(`/admin/users/${id}`, adminUserDetailSchema, { method: 'PATCH', body: input }),
    onSuccess: (detail) => {
      invalidate(detail)
      toast.success('Profil gespeichert.')
    },
  })
}

export function useSetUserAdmin() {
  const invalidate = useUserInvalidation()
  return useMutation({
    mutationFn: ({ id, isAdmin }: { id: number; isAdmin: boolean }): Promise<AdminUserDetail> =>
      apiFetch(`/admin/users/${id}/admin`, adminUserDetailSchema, { method: 'POST', body: { is_admin: isAdmin } }),
    onSuccess: (detail, { isAdmin }) => {
      invalidate(detail)
      toast.success(isAdmin ? 'Admin-Rechte vergeben.' : 'Admin-Rechte entzogen.')
    },
  })
}

export function useSetUserActive() {
  const invalidate = useUserInvalidation()
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }): Promise<AdminUserDetail> =>
      apiFetch(`/admin/users/${id}/active`, adminUserDetailSchema, { method: 'POST', body: { active } }),
    onSuccess: (detail, { active }) => {
      invalidate(detail)
      toast.success(active ? 'Benutzer reaktiviert.' : 'Benutzer deaktiviert.')
    },
  })
}

export function useSoftDeleteUser() {
  const invalidate = useUserInvalidation()
  return useMutation({
    mutationFn: (id: number): Promise<AdminUserDetail> => apiFetch(`/admin/users/${id}`, adminUserDetailSchema, { method: 'DELETE' }),
    onSuccess: (detail) => {
      invalidate(detail)
      toast.success('Benutzer gelöscht.')
    },
  })
}

export function useRestoreUser() {
  const invalidate = useUserInvalidation()
  return useMutation({
    mutationFn: (id: number): Promise<AdminUserDetail> => apiFetch(`/admin/users/${id}/restore`, adminUserDetailSchema, { method: 'POST' }),
    onSuccess: (detail) => {
      invalidate(detail)
      toast.success('Benutzer wiederhergestellt.')
    },
  })
}

// ──────────────────────────── Gruppen ────────────────────────────

export function useRestoreGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await apiFetch(`/admin/groups/${id}/restore`, adminGroupRowSchema, { method: 'POST' }) // 204 → Schema ungenutzt
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: qk.admin.all })
      qc.invalidateQueries({ queryKey: [...qk.groups.all, 'list'] })
      qc.invalidateQueries({ queryKey: qk.groups.detail(id) })
      toast.success('Gruppe wiederhergestellt.')
    },
  })
}

// ──────────────────────────── Startplätze ────────────────────────────

/** Startplätze speisen auch den Treffen-Wizard und die Karte → `qk.spots` mit invalidieren. */
function useSpotInvalidation() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: qk.admin.all })
    qc.invalidateQueries({ queryKey: qk.spots })
  }
}

export function useCreateSpot() {
  const invalidate = useSpotInvalidation()
  return useMutation({
    mutationFn: (input: AdminSpotPayload): Promise<AdminSpot> => apiFetch('/admin/spots', adminSpotSchema, { method: 'POST', body: input }),
    onSuccess: () => {
      invalidate()
      toast.success('Startplatz angelegt.')
    },
  })
}

export function useUpdateSpot(id: number) {
  const invalidate = useSpotInvalidation()
  return useMutation({
    mutationFn: (input: AdminSpotPayload): Promise<AdminSpot> => apiFetch(`/admin/spots/${id}`, adminSpotSchema, { method: 'PATCH', body: input }),
    onSuccess: () => {
      invalidate()
      toast.success('Startplatz gespeichert.')
    },
  })
}

export function useDeleteSpot() {
  const invalidate = useSpotInvalidation()
  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await apiFetch(`/admin/spots/${id}`, adminSpotSchema, { method: 'DELETE' }) // 204 → Schema ungenutzt
    },
    onSuccess: () => {
      invalidate()
      toast.success('Startplatz gelöscht.')
    },
  })
}

/**
 * Frischt das gesamte Admin-Dashboard auf. Für Aktionen, die über die **öffentlichen** Hooks laufen
 * (Treffen bearbeiten/absagen/löschen): deren `onSuccess` kennt die Admin-Keys bewusst nicht — sonst
 * hinge der öffentliche Hook am Admin-Feature. React Query ruft das `onSuccess` der Aufrufstelle
 * zusätzlich auf, also wird das hier je Aufruf mitgegeben.
 */
export function useAdminInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: qk.admin.all })
}
