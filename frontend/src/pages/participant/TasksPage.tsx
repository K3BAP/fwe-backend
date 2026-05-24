import { Link } from 'react-router-dom'
import { useMe, useTasks } from '../../api/participant'
import type { ParticipantTask } from '../../api/types'
import { TASK_TYPE_LABEL } from '../../lib/taskTypes'
import { Badge, Card, Spinner } from '../../components/ui'

function statusBadge(task: ParticipantTask) {
  const sub = task.submission
  if (!sub) return <Badge tone="gray">Offen</Badge>
  switch (sub.status) {
    case 'pending':
      return <Badge tone="amber">Wird geprüft</Badge>
    case 'correct':
      return <Badge tone="green">{sub.points ?? 0} Pkt.</Badge>
    case 'incorrect':
      return <Badge tone="red">0 Pkt.</Badge>
    case 'evaluated':
      return <Badge tone="indigo">{sub.points ?? 0} Pkt.</Badge>
  }
}

export default function TasksPage() {
  const { data: me } = useMe()
  const { data: tasks, isLoading } = useTasks(me?.rallye.id)

  const total = (tasks ?? []).reduce((sum, t) => sum + (t.submission?.points ?? 0), 0)

  if (isLoading || !tasks)
    return <Spinner />

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between bg-gradient-to-br from-indigo-600 to-indigo-500 text-white ring-0">
        <span className="text-sm font-medium text-indigo-100">Deine Punkte</span>
        <span className="text-3xl font-bold">{total}</span>
      </Card>

      <div className="space-y-3">
        {tasks.map((task) => (
          <Link key={task.id} to={`/rallye/task/${task.id}`} className="block">
            <Card className="flex items-center justify-between gap-3 transition active:scale-[0.99]">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{task.title}</p>
                <p className="text-xs text-slate-500">{TASK_TYPE_LABEL[task.type]} · max. {task.max_points} Pkt.</p>
              </div>
              {statusBadge(task)}
            </Card>
          </Link>
        ))}
        {tasks.length === 0 && <p className="text-center text-slate-500">Noch keine Stationen vorhanden.</p>}
      </div>
    </div>
  )
}
