import { useMeetups } from '@/api/meetups'
import { useGroups } from '@/api/groups'
import { useAuthStore } from '@/stores/authStore'
import { MeetupCard } from '@/components/meetups/MeetupCard'
import { GroupMiniCard } from '@/components/groups/GroupMiniCard'
import { StatCard } from '@/components/dashboard/StatCard'
import { SectionHeader } from '@/components/dashboard/SectionHeader'
import { EmptyState, Skeleton } from '@/components/ui'
import { ClockIcon, GroupIcon, WingIcon } from '@/components/layout/icons'

/** Eingeloggte Startseite: Begrüßung, Kennzahlen, aktuelle Treffen & eigene Gruppen (Mock). */
export function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const firstName = user?.displayName.split(' ')[0] ?? 'Pilot'
  const meetups = useMeetups()
  const groups = useGroups()

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl">Servus, {firstName} 👋</h1>
        <p className="mt-1 text-base-content/60">Bereit für die nächste Thermik?</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<WingIcon size={22} />} value="12" label="Flüge 2026" />
        <StatCard icon={<ClockIcon size={22} />} value="48 h" label="Flugstunden" />
        <StatCard icon={<GroupIcon size={22} />} value={groups.data?.length ?? '–'} label="Gruppen" />
      </div>

      <section>
        <SectionHeader title="Aktuelle Flugtreffen" to="/flugtreffen" />
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-5 sm:px-5">
          {meetups.isLoading &&
            Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-64 w-[300px] shrink-0" />)}
          {meetups.data?.slice(0, 6).map((m) => (
            <div key={m.id} className="w-[300px] shrink-0">
              <MeetupCard meetup={m} />
            </div>
          ))}
          {meetups.data && meetups.data.length === 0 && (
            <EmptyState className="w-full" title="Noch keine Flugtreffen" description="Erstelle das erste in deiner Region." />
          )}
        </div>
      </section>

      <section>
        <SectionHeader title="Deine Gruppen" to="/gruppen" />
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-5 sm:px-5">
          {groups.isLoading &&
            Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 w-40 shrink-0" />)}
          {groups.data?.slice(0, 6).map((g) => <GroupMiniCard key={g.id} group={g} />)}
          {groups.data && groups.data.length === 0 && (
            <EmptyState className="w-full" title="Noch keine Gruppen" description="Entdecke Communities in deiner Region." />
          )}
        </div>
      </section>
    </div>
  )
}
