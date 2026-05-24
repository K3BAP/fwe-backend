import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { useSession } from '../store/session'
import type {
  LeaderboardRow,
  Participant,
  ParticipantTask,
  Rallye,
  Team,
} from './types'

const token = () => useSession.getState().token

// --- Öffentlich ---
export function useRallyeByCode(code: string | undefined) {
  return useQuery({
    queryKey: ['rallye', code],
    enabled: !!code,
    queryFn: () => api<{ rallye: Rallye }>(`/rallyes/${code}`).then((r) => r.rallye),
  })
}

export function useJoin() {
  return useMutation({
    mutationFn: (vars: { code: string; displayName: string }) =>
      api<{ token: string; participant: Participant; rallye: Rallye }>(
        `/rallyes/${vars.code}/join`,
        { body: { display_name: vars.displayName } },
      ),
  })
}

// --- Teilnehmer (Token) ---
export function useMe(enabled = true) {
  return useQuery({
    queryKey: ['me'],
    enabled,
    queryFn: () =>
      api<{ participant: Participant; rallye: Rallye; team: Team | null }>('/me', { token: token() }),
  })
}

export function useTeams(rallyeId: number | null | undefined) {
  return useQuery({
    queryKey: ['teams', rallyeId],
    enabled: !!rallyeId,
    queryFn: () => api<{ teams: Team[] }>(`/rallyes/${rallyeId}/teams`, { token: token() }).then((r) => r.teams),
  })
}

// Aktualisiert den me-Cache sofort mit dem gewählten Team, damit der
// Team-Gate im Layout nicht kurzzeitig zurück zur Team-Auswahl springt.
function applyTeamToMe(qc: ReturnType<typeof useQueryClient>, team: Team) {
  qc.setQueryData<{ participant: Participant; rallye: Rallye; team: Team | null }>(['me'], (old) =>
    old ? { ...old, team, participant: { ...old.participant, team_id: team.id } } : old,
  )
  qc.invalidateQueries({ queryKey: ['me'] })
}

export function useCreateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api<{ team: Team }>('/teams', { body: { name }, token: token() }),
    onSuccess: (res) => applyTeamToMe(qc, res.team),
  })
}

export function useJoinTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (teamId: number) =>
      api<{ team: Team }>(`/teams/${teamId}/join`, { method: 'POST', token: token() }),
    onSuccess: (res) => applyTeamToMe(qc, res.team),
  })
}

export function useTasks(rallyeId: number | null | undefined) {
  return useQuery({
    queryKey: ['tasks', rallyeId],
    enabled: !!rallyeId,
    refetchInterval: 10000,
    queryFn: () =>
      api<{ tasks: ParticipantTask[] }>(`/rallyes/${rallyeId}/tasks`, { token: token() }).then((r) => r.tasks),
  })
}

export interface SubmitResult {
  submission: { id: number; status: string; points: number | null }
  instant: boolean
}

export function useSubmit(taskId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<SubmitResult>(`/tasks/${taskId}/submit`, { body, token: token() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['leaderboard'] })
    },
  })
}

export function useUploadPhoto(taskId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('photo', file)
      return api<SubmitResult>(`/tasks/${taskId}/photo`, { form, token: token() })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useLeaderboard(rallyeId: number | null | undefined) {
  return useQuery({
    queryKey: ['leaderboard', rallyeId],
    enabled: !!rallyeId,
    refetchInterval: 8000,
    queryFn: () =>
      api<{ leaderboard: LeaderboardRow[]; my_team_id: number | null }>(
        `/rallyes/${rallyeId}/leaderboard`,
        { token: token() },
      ),
  })
}
