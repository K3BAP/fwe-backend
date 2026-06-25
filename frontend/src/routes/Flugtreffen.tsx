import { useMeetups } from '@/api/meetups'
import { MeetupCard } from '@/components/meetups/MeetupCard'
import { Card } from '@/components/ui'

function SkeletonCard() {
  return (
    <Card className="overflow-hidden">
      <div className="h-38 animate-pulse bg-base-300" />
      <div className="flex flex-col gap-3 p-4.5">
        <div className="h-4 w-24 animate-pulse rounded-full bg-base-300" />
        <div className="h-5 w-3/4 animate-pulse rounded bg-base-300" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-base-300" />
      </div>
    </Card>
  )
}

/**
 * Flugtreffen-Übersicht (M1, Mock-Daten über die Daten-Naht).
 * Die drei Ansichten (Karte/Tabelle/Cards) + Suche/Filter folgen in M1; hier die Cards-Ansicht
 * als Beweis der typisierten Hook→DTO-Naht.
 */
export function Flugtreffen() {
  const { data, isLoading, isError } = useMeetups()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl">Flugtreffen</h1>
        <p className="mt-1 text-base-content/60">Finde gemeinsame Flugtage in deiner Region.</p>
      </div>

      {isError && (
        <p className="rounded-box bg-error/10 px-4 py-3 text-sm text-error">
          Flugtreffen konnten nicht geladen werden. Bitte später erneut versuchen.
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
        {data?.map((m) => <MeetupCard key={m.id} meetup={m} />)}
      </div>

      {data && data.length === 0 && (
        <div className="rounded-box border border-base-300 bg-base-100 px-6 py-12 text-center text-base-content/60">
          Noch keine Flugtreffen in deiner Region. Erstelle das erste!
        </div>
      )}
    </div>
  )
}
