import { useMeetups } from '@/api/meetups'
import { useGroups } from '@/api/groups'
import { useAuthStore } from '@/stores/authStore'
import { MeetupCard } from '@/components/meetups/MeetupCard'
import { GroupMiniCard } from '@/components/groups/GroupMiniCard'
import { StatCard } from '@/components/dashboard/StatCard'
import { SectionHeader } from '@/components/dashboard/SectionHeader'
import { EmptyState, Skeleton, Stagger, StaggerItem } from '@/components/ui'

/** Eingeloggte Startseite: Begrüßung, Kennzahlen, aktuelle Treffen & eigene Gruppen. */
export function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const firstName = user?.displayName.split(' ')[0] ?? 'Pilot'
  // Teaser: die nächsten anstehenden Treffen (ab heute), nicht die vergangenen.
  const today = new Date().toISOString().slice(0, 10)
  const meetups = useMeetups({ sort: 'starts_at_asc', limit: 6, date_from: today })
  const groups = useGroups()
  const upcoming = meetups.data?.items ?? []

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl">Servus, {firstName} 👋</h1>
        <p className="mt-1 text-base-content/60">
          {upcoming.length} Flugtreffen in deiner Region · plane deinen nächsten Flugtag.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-3.5 lg:grid-cols-4">
        <StatCard value="12" label="Flüge 2026" valueClassName="text-primary" />
        <StatCard value={<>480<span className="text-base font-bold text-base-content/50">h</span></>} label="Flugstunden" valueClassName="text-secondary" />
        <StatCard value={groups.data?.length ?? '–'} label="Gruppen" valueClassName="text-accent" />
        <StatCard value="28" label="Teilnahmen" className="hidden lg:block" />
      </div>

      <section>
        <SectionHeader title="Aktuelle Flugtreffen" to="/flugtreffen" />
        {meetups.isLoading && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-72" />)}
          </div>
        )}
        {!meetups.isLoading && upcoming.length === 0 && (
          <EmptyState title="Noch keine Flugtreffen" description="Erstelle das erste in deiner Region." />
        )}
        {upcoming.length > 0 && (
          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((m) => (
              <StaggerItem key={m.id}>
                <MeetupCard meetup={m} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>

      <section>
        <SectionHeader title="Deine Gruppen" to="/gruppen" />
        {groups.isLoading && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        )}
        {!groups.isLoading && (groups.data?.length ?? 0) === 0 && (
          <EmptyState title="Noch keine Gruppen" description="Entdecke Communities in deiner Region." />
        )}
        {(groups.data?.length ?? 0) > 0 && (
          <Stagger className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {groups.data?.slice(0, 6).map((g) => (
              <StaggerItem key={g.id}>
                <GroupMiniCard group={g} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>
    </div>
  )
}
