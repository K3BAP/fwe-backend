import { Link } from 'react-router-dom'
import { useMe, useTasks } from '../../api/participant'
import type { ParticipantTask } from '../../api/types'
import { TASK_TYPE_LABEL } from '../../lib/taskTypes'
import { Badge, Card, Skeleton } from '../../components/ui'
import { CountUp, Item, Stagger } from '../../components/motion'

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

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

  const team = me?.team
  const isTeam = !!team && Number(team.is_solo) === 0
  const members = Number(team?.member_count ?? 0)
  const solved = (tasks ?? []).filter((t) => t.submission && t.submission.status !== 'incorrect').length

  const eyebrow = isTeam ? 'Teampunkte' : 'Deine Punkte'
  const subtitle = isTeam
    ? members > 1
      ? `${team!.name} · ${members} Mitglieder`
      : `${team!.name} · Du bist allein im Team`
    : 'Solo unterwegs'

  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden bg-gradient-to-br from-brand-500 to-brand-700 text-white ring-0">
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-12 -left-6 h-28 w-28 rounded-full bg-white/5" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-brand-100">
              {isTeam ? <UsersIcon /> : <UserIcon />}
              <span className="text-xs font-semibold uppercase tracking-wide">{eyebrow}</span>
            </div>
            <p className="mt-2 truncate text-sm font-medium text-white/90">{subtitle}</p>
            <p className="mt-0.5 text-xs text-brand-200">{solved} von {tasks.length} Stationen gelöst</p>
          </div>
          <div className="shrink-0 text-right">
            <CountUp value={total} className="text-4xl font-bold leading-none" />
            <p className="mt-1 text-xs font-medium text-brand-200">Punkte</p>
          </div>
        </div>
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
