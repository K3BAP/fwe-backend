import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useAdminLeaderboard } from '../../api/admin'
import type { AdminLeaderboardTask, SubmissionStatus, TaskScore } from '../../api/types'
import { Badge, Card, Skeleton } from '../../components/ui'
import { CountUp } from '../../components/motion'
import { spring } from '../../lib/motion'

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

  if (isLoading || !data) return <Skeleton className="h-40 w-full" />

  const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`)

  return (
    <div className="space-y-5">
      <Link to="/admin" className="text-sm font-medium text-brand-600 dark:text-brand-300">
        ← Alle Rallyes
      </Link>
      <h1 className="text-2xl font-bold text-fg">Rangliste</h1>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {data.leaderboard.map((row) => {
            const isOpen = open === row.team_id
            return (
              <motion.div
                key={row.team_id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={spring}
              >
                <Card className="space-y-0 p-0">
                  <button
                    onClick={() => setOpen(isOpen ? null : row.team_id)}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-center text-lg font-bold text-fg">{medal(row.rank)}</span>
                      <span className="font-semibold text-fg">{row.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CountUp value={row.total} className="text-lg font-bold text-brand-600 dark:text-brand-300" />
                      <motion.span animate={{ rotate: isOpen ? 180 : 0 }} className="text-muted">
                        ▼
                      </motion.span>
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <TeamBreakdown tasks={data.tasks} scores={data.breakdowns[row.team_id] ?? {}} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {data.leaderboard.length === 0 && <p className="text-center text-muted">Noch keine Teams.</p>}
      </div>
    </div>
  )
}

function TeamBreakdown({ tasks, scores }: { tasks: AdminLeaderboardTask[]; scores: Record<number, TaskScore> }) {
  if (tasks.length === 0) {
    return <p className="border-t border-line p-4 text-sm text-muted">Keine Aufgaben.</p>
  }

  return (
    <div className="divide-y divide-line border-t border-line">
      {tasks.map((task) => {
        const score = scores[task.id]
        return (
          <div key={task.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="min-w-0 truncate text-sm text-fg">{task.title}</span>
            <div className="flex shrink-0 items-center gap-2">
              {score ? <Badge tone={STATUS_TONE[score.status]}>{STATUS_LABEL[score.status]}</Badge> : <Badge tone="gray">Keine Abgabe</Badge>}
              <span className="w-14 text-right text-sm font-semibold text-fg">
                {score && score.points !== null ? `${score.points}` : '–'}
                <span className="text-muted"> / {task.max_points}</span>
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
