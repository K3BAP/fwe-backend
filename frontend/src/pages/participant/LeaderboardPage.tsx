import { useMe, useLeaderboard } from '../../api/participant'
import { Card, Spinner } from '../../components/ui'

export default function LeaderboardPage() {
  const { data: me } = useMe()
  const { data, isLoading } = useLeaderboard(me?.rallye.id)

  if (isLoading || !data) return <Spinner />

  const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Rangliste</h1>
      <div className="space-y-2">
        {data.leaderboard.map((row) => {
          const mine = row.team_id === data.my_team_id
          return (
            <Card
              key={row.team_id}
              className={`flex items-center justify-between ${mine ? 'ring-2 ring-indigo-500' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span className="w-8 text-center text-lg font-bold text-slate-700">{medal(row.rank)}</span>
                <span className="font-semibold text-slate-900">
                  {row.name}
                  {mine && <span className="ml-2 text-xs font-medium text-indigo-600">(dein Team)</span>}
                </span>
              </div>
              <span className="text-lg font-bold text-indigo-600">{row.total}</span>
            </Card>
          )
        })}
        {data.leaderboard.length === 0 && <p className="text-center text-slate-500">Noch keine Teams.</p>}
      </div>
    </div>
  )
}
