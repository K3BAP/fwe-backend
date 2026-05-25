import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAdminLeaderboard } from '../../api/admin'
import type { AdminLeaderboardTask, SubmissionStatus, TaskScore } from '../../api/types'
import { Badge, Card, Spinner } from '../../components/ui'

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: 'Offen',
  correct: 'Richtig',
  incorrect: 'Falsch',
  evaluated: 'Bewertet',
}
const STATUS_TONE: Record<SubmissionStatus, 'gray' | 'green' | 'red' | 'amber'> = {
  pending: 'amber',
  correct: 'green',
  incorrect: 'red',
  evaluated: 'green',
}

export default function LeaderboardPage() {
  const { id } = useParams<{ id: string }>()
  const rallyeId = Number(id)
  const { data, isLoading } = useAdminLeaderboard(rallyeId)
  const [open, setOpen] = useState<number | null>(null)

  if (isLoading || !data) return <Spinner />

  const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`)

  return (
    <div className="space-y-5">
      <Link to="/admin" className="text-sm font-medium text-indigo-600">
        ← Alle Rallyes
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">Rangliste</h1>

      <div className="space-y-2">
        {data.leaderboard.map((row) => {
          const isOpen = open === row.team_id
          return (
            <Card key={row.team_id} className="space-y-0 p-0">
              <button
                onClick={() => setOpen(isOpen ? null : row.team_id)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center text-lg font-bold text-slate-700">{medal(row.rank)}</span>
                  <span className="font-semibold text-slate-900">{row.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-indigo-600">{row.total}</span>
                  <span className="text-slate-400">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {isOpen && (
                <TeamBreakdown tasks={data.tasks} scores={data.breakdowns[row.team_id] ?? {}} />
              )}
            </Card>
          )
        })}
        {data.leaderboard.length === 0 && <p className="text-center text-slate-500">Noch keine Teams.</p>}
      </div>
    </div>
  )
}

function TeamBreakdown({
  tasks,
  scores,
}: {
  tasks: AdminLeaderboardTask[]
  scores: Record<number, TaskScore>
}) {
  if (tasks.length === 0) {
    return <p className="border-t border-slate-100 p-4 text-sm text-slate-500">Keine Aufgaben.</p>
  }

  return (
    <div className="divide-y divide-slate-100 border-t border-slate-100">
      {tasks.map((task) => {
        const score = scores[task.id]
        return (
          <div key={task.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="min-w-0 truncate text-sm text-slate-700">{task.title}</span>
            <div className="flex shrink-0 items-center gap-2">
              {score ? (
                <Badge tone={STATUS_TONE[score.status]}>{STATUS_LABEL[score.status]}</Badge>
              ) : (
                <Badge tone="gray">Keine Abgabe</Badge>
              )}
              <span className="w-14 text-right text-sm font-semibold text-slate-900">
                {score && score.points !== null ? `${score.points}` : '–'}
                <span className="text-slate-400"> / {task.max_points}</span>
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
