import { AnimatePresence, motion } from 'motion/react'
import { useMe, useLeaderboard } from '../../api/participant'
import { Skeleton } from '../../components/ui'
import { CountUp } from '../../components/motion'
import { spring } from '../../lib/motion'

export default function LeaderboardPage() {
  const { data: me } = useMe()
  const { data, isLoading } = useLeaderboard(me?.rallye.id)

  if (isLoading || !data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    )

  const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-fg">Rangliste</h1>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {data.leaderboard.map((row) => {
            const mine = row.team_id === data.my_team_id
            return (
              <motion.div
                key={row.team_id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={spring}
                className={`flex items-center justify-between rounded-2xl bg-surface p-5 shadow-card ring-1 ${
                  mine ? 'ring-2 ring-brand-500' : 'ring-line'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center text-lg font-bold text-fg">{medal(row.rank)}</span>
                  <span className="font-semibold text-fg">
                    {row.name}
                    {mine && <span className="ml-2 text-xs font-medium text-brand-600 dark:text-brand-300">(dein Team)</span>}
                  </span>
                </div>
                <CountUp value={row.total} className="text-lg font-bold text-brand-600 dark:text-brand-300" />
              </motion.div>
            )
          })}
        </AnimatePresence>
        {data.leaderboard.length === 0 && <p className="text-center text-muted">Noch keine Teams.</p>}
      </div>
    </div>
  )
}
