import { Link } from 'react-router-dom'
import { useMe, useTasks } from '../../api/participant'
import type { ParticipantTask } from '../../api/types'
import { TASK_TYPE_LABEL } from '../../lib/taskTypes'
import { Badge, Card, Skeleton } from '../../components/ui'
import { CountUp, Item, Stagger } from '../../components/motion'

function statusBadge(task: ParticipantTask) {
  const sub = task.submission
  if (!sub) return <Badge tone="gray">Offen</Badge>
  switch (sub.status) {
    case 'pending':
      return (
        <Badge tone="amber" pulse>
          Wird geprüft
        </Badge>
      )
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
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    )

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between bg-gradient-to-br from-brand-600 to-brand-500 text-white ring-0">
        <span className="text-sm font-medium text-brand-100">Deine Punkte</span>
        <CountUp value={total} className="text-3xl font-bold" />
      </Card>

      <Stagger className="space-y-3">
        {tasks.map((task) => (
          <Item key={task.id}>
            <Link to={`/rallye/task/${task.id}`} className="block">
              <Card interactive className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-fg">{task.title}</p>
                  <p className="text-xs text-muted">
                    {TASK_TYPE_LABEL[task.type]} · max. {task.max_points} Pkt.
                  </p>
                </div>
                {statusBadge(task)}
              </Card>
            </Link>
          </Item>
        ))}
        {tasks.length === 0 && <p className="text-center text-muted">Noch keine Stationen vorhanden.</p>}
      </Stagger>
    </div>
  )
}
