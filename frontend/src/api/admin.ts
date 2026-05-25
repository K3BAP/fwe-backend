import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { useAdminAuth } from '../store/adminAuth'
import type {
  AdminLeaderboard,
  AdminParticipant,
  AdminTask,
  AdminUser,
  PendingSubmission,
  Rallye,
  TaskConfig,
  TaskType,
} from './types'

const token = () => useAdminAuth.getState().token

export function useAdminLogin() {
  return useMutation({
    mutationFn: (vars: { username: string; password: string }) =>
      api<{ token: string; admin: { id: number; username: string } }>('/admin/login', { body: vars }),
  })
}

export function useRallyes() {
  return useQuery({
    queryKey: ['admin', 'rallyes'],
    queryFn: () => api<{ rallyes: Rallye[] }>('/admin/rallyes', { token: token() }).then((r) => r.rallyes),
  })
}

export function useRallye(id: number) {
  return useQuery({
    queryKey: ['admin', 'rallye', id],
    queryFn: () => api<{ rallye: Rallye }>(`/admin/rallyes/${id}`, { token: token() }).then((r) => r.rallye),
  })
}

export function useSaveRallye() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id?: number; data: Partial<Rallye> }) =>
      vars.id
        ? api<{ rallye: Rallye }>(`/admin/rallyes/${vars.id}`, { method: 'PUT', body: vars.data, token: token() })
        : api<{ rallye: Rallye }>('/admin/rallyes', { body: vars.data, token: token() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'rallyes'] }),
  })
}

export function useSetStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: number; status: string }) =>
      api(`/admin/rallyes/${vars.id}/status`, { body: { status: vars.status }, token: token() }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'rallyes'] })
      qc.invalidateQueries({ queryKey: ['admin', 'rallye', vars.id] })
    },
  })
}

export function useDeleteRallye() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api(`/admin/rallyes/${id}`, { method: 'DELETE', token: token() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'rallyes'] }),
  })
}

// --- Aufgaben ---
export function useAdminTasks(rallyeId: number) {
  return useQuery({
    queryKey: ['admin', 'tasks', rallyeId],
    queryFn: () => api<{ tasks: AdminTask[] }>(`/admin/rallyes/${rallyeId}/tasks`, { token: token() }).then((r) => r.tasks),
  })
}

export interface TaskInput {
  type: TaskType
  title: string
  prompt: string
  max_points: number
  config: TaskConfig
}

export function useSaveTask(rallyeId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id?: number; data: TaskInput }) =>
      vars.id
        ? api(`/admin/tasks/${vars.id}`, { method: 'PUT', body: vars.data, token: token() })
        : api(`/admin/rallyes/${rallyeId}/tasks`, { body: vars.data, token: token() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tasks', rallyeId] }),
  })
}

export function useDeleteTask(rallyeId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api(`/admin/tasks/${id}`, { method: 'DELETE', token: token() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tasks', rallyeId] }),
  })
}

export function useReorderTasks(rallyeId: number) {
  const qc = useQueryClient()
  const key = ['admin', 'tasks', rallyeId]
  return useMutation({
    mutationFn: (order: number[]) =>
      api(`/admin/rallyes/${rallyeId}/tasks/reorder`, { method: 'PUT', body: { order }, token: token() }),
    onMutate: async (order: number[]) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<AdminTask[]>(key)
      if (previous) {
        const byId = new Map(previous.map((t) => [t.id, t]))
        qc.setQueryData<AdminTask[]>(
          key,
          order.map((id) => byId.get(id)).filter((t): t is AdminTask => t != null),
        )
      }
      return { previous }
    },
    onError: (_err, _order, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

// --- Bewertung ---
export function usePending(rallyeId: number) {
  return useQuery({
    queryKey: ['admin', 'pending', rallyeId],
    refetchInterval: 8000,
    queryFn: () => api<{ pending: PendingSubmission[] }>(`/admin/rallyes/${rallyeId}/pending`, { token: token() }).then((r) => r.pending),
  })
}

export function useEvaluate(rallyeId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: number; correct: boolean; points?: number }) =>
      api(`/admin/submissions/${vars.id}/evaluate`, {
        body: { correct: vars.correct, points: vars.points },
        token: token(),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'pending', rallyeId] }),
  })
}

export function useOnsiteSubmit() {
  return useMutation({
    mutationFn: (vars: { token: string; task_id: number; value: number }) =>
      api<{ submission: unknown; team_name: string | null }>('/admin/submissions/onsite', {
        body: vars,
        token: token(),
      }),
  })
}

// --- Leaderboard ---
export function useAdminLeaderboard(rallyeId: number) {
  return useQuery({
    queryKey: ['admin', 'leaderboard', rallyeId],
    refetchInterval: 8000,
    queryFn: () => api<AdminLeaderboard>(`/admin/rallyes/${rallyeId}/leaderboard`, { token: token() }),
  })
}

// --- Teilnehmer & Admins ---
export function useParticipants(rallyeId: number) {
  return useQuery({
    queryKey: ['admin', 'participants', rallyeId],
    queryFn: () => api<{ participants: AdminParticipant[] }>(`/admin/rallyes/${rallyeId}/participants`, { token: token() }).then((r) => r.participants),
  })
}

export function useReissue() {
  return useMutation({
    mutationFn: (id: number) =>
      api<{ token: string }>(`/admin/participants/${id}/reissue`, { method: 'POST', token: token() }),
  })
}

export function useAdmins() {
  return useQuery({
    queryKey: ['admin', 'admins'],
    queryFn: () => api<{ admins: AdminUser[] }>('/admin/admins', { token: token() }).then((r) => r.admins),
  })
}

export function useCreateAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { username: string; password: string }) =>
      api('/admin/admins', { body: vars, token: token() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'admins'] }),
  })
}

export function useDeleteAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api(`/admin/admins/${id}`, { method: 'DELETE', token: token() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'admins'] }),
  })
}
