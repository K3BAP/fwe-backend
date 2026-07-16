import { Link } from 'react-router-dom'
import { useAdminStats } from '@/api/admin'
import type { AdminStats } from '@/api/schemas'
import { Card, Skeleton, Stagger, StaggerItem } from '@/components/ui'

type Stat = { label: string; value: number; hint?: string; tone?: 'error' | 'warning' }

/** Kennzahlen-Gruppe → Kacheln. Reine Ableitung, damit die Seite selbst flach bleibt. */
function statsFor(stats: AdminStats): { title: string; to: string; items: Stat[] }[] {
  return [
    {
      title: 'Benutzer',
      to: '/admin/benutzer',
      items: [
        { label: 'Gesamt', value: stats.users.total },
        { label: 'Aktiv', value: stats.users.active },
        { label: 'Gesperrt', value: stats.users.suspended, tone: stats.users.suspended > 0 ? 'warning' : undefined },
        { label: 'Gelöscht', value: stats.users.deleted, tone: stats.users.deleted > 0 ? 'error' : undefined },
        { label: 'Admins', value: stats.users.admins },
        { label: 'Neu (7 Tage)', value: stats.users.new_7d },
      ],
    },
    {
      title: 'Flugtreffen',
      to: '/admin/flugtreffen',
      items: [
        { label: 'Gesamt', value: stats.meetups.total },
        { label: 'Anstehend', value: stats.meetups.upcoming },
        { label: 'Abgesagt', value: stats.meetups.cancelled, tone: stats.meetups.cancelled > 0 ? 'warning' : undefined },
      ],
    },
    {
      title: 'Gruppen',
      to: '/admin/gruppen',
      items: [
        { label: 'Gesamt', value: stats.groups.total },
        { label: 'Aktiv', value: stats.groups.active },
        { label: 'Privat', value: stats.groups.private },
        { label: 'Gelöscht', value: stats.groups.deleted, tone: stats.groups.deleted > 0 ? 'error' : undefined },
      ],
    },
    {
      title: 'Startplätze',
      to: '/admin/spots',
      items: [{ label: 'Gesamt', value: stats.spots.total }],
    },
  ]
}

/** Einstieg des Admin-Bereichs: Kennzahlen der Instanz auf einen Blick. */
export function AdminOverview() {
  const { data: stats, isLoading, isError } = useAdminStats()

  if (isError) {
    return (
      <p className="rounded-box bg-error/10 px-4 py-3 text-sm text-error">
        Kennzahlen konnten nicht geladen werden. Bitte später erneut versuchen.
      </p>
    )
  }

  if (isLoading || !stats) {
    return (
      <div className="flex flex-col gap-6">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[132px]" />
        ))}
      </div>
    )
  }

  return (
    <Stagger className="flex flex-col gap-6">
      {statsFor(stats).map((group) => (
        <StaggerItem key={group.title}>
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl">{group.title}</h2>
              <Link to={group.to} className="text-sm text-primary hover:underline">
                Verwalten
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {group.items.map((stat) => (
                <Card key={stat.label} className="flex flex-col gap-1 p-4">
                  <span className="text-sm text-base-content/60">{stat.label}</span>
                  <span
                    className={
                      stat.tone === 'error' ? 'font-display text-3xl text-error' : stat.tone === 'warning' ? 'font-display text-3xl text-warning' : 'font-display text-3xl'
                    }
                  >
                    {stat.value}
                  </span>
                </Card>
              ))}
            </div>
          </section>
        </StaggerItem>
      ))}
      <p className="text-xs text-base-content/55">Kennzahlen werden bei jedem Aufruf frisch berechnet.</p>
    </Stagger>
  )
}
