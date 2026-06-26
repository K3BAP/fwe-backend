import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMeetups } from '@/api/meetups'
import { MeetupCard } from '@/components/meetups/MeetupCard'
import { MeetupFilters, type MeetupFilterState } from '@/components/meetups/MeetupFilters'
import { MeetupMap } from '@/components/meetups/MeetupMap'
import { MeetupTable } from '@/components/meetups/MeetupTable'
import { EmptyState, SegmentedControl, Skeleton, type SegmentOption } from '@/components/ui'
import { PlusIcon, WingIcon } from '@/components/layout/icons'

type View = 'cards' | 'table' | 'map'
const VIEW_OPTIONS: SegmentOption<View>[] = [
  { value: 'cards', label: 'Cards' },
  { value: 'table', label: 'Tabelle' },
  { value: 'map', label: 'Karte' },
]

const EMPTY_FILTERS: MeetupFilterState = { search: '', region: '', level: '', freeOnly: false }

/** Flugtreffen-Übersicht: Cards/Tabelle/Karte-Umschalter + client-seitige Suche/Filter (Mock). */
export function Flugtreffen() {
  const { data, isLoading, isError } = useMeetups()
  const [view, setView] = useState<View>('cards')
  const [filters, setFilters] = useState<MeetupFilterState>(EMPTY_FILTERS)

  const regions = useMemo(
    () => [...new Set((data ?? []).map((m) => m.region))].sort((a, b) => a.localeCompare(b, 'de')),
    [data],
  )

  const filtered = useMemo(() => {
    return (data ?? []).filter((m) => {
      const haystack = `${m.title} ${m.spot_name} ${m.region}`.toLowerCase()
      if (filters.search && !haystack.includes(filters.search.toLowerCase())) return false
      if (filters.region && m.region !== filters.region) return false
      if (filters.level && m.experience_level !== filters.level) return false
      if (filters.freeOnly && !(m.derived_status === 'open' && (m.free_spots == null || m.free_spots > 0))) return false
      return true
    })
  }, [data, filters])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl">Flugtreffen</h1>
          <p className="mt-1 text-base-content/60">Finde gemeinsame Flugtage in deiner Region.</p>
        </div>
        <Link to="/flugtreffen/neu" className="btn btn-primary rounded-full shadow-[0_8px_18px_rgba(30,144,230,.3)]">
          <PlusIcon size={18} /> Treffen erstellen
        </Link>
      </div>

      <MeetupFilters value={filters} onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))} regions={regions} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-base-content/55">{isLoading ? 'Lädt…' : `${filtered.length} Treffen`}</span>
        <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} aria-label="Ansicht" />
      </div>

      {isError && (
        <p className="rounded-box bg-error/10 px-4 py-3 text-sm text-error">
          Flugtreffen konnten nicht geladen werden. Bitte später erneut versuchen.
        </p>
      )}

      {isLoading && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-72" />)}
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState
          icon={<WingIcon size={26} />}
          title="Keine Treffen gefunden"
          description="Passe die Filter an oder erstelle das erste Treffen in deiner Region."
          action={
            <Link to="/flugtreffen/neu" className="btn btn-primary btn-sm rounded-full">
              Treffen erstellen
            </Link>
          }
        />
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <>
          {view === 'cards' && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((m) => <MeetupCard key={m.id} meetup={m} />)}
            </div>
          )}
          {view === 'table' && <MeetupTable meetups={filtered} />}
          {view === 'map' && <MeetupMap meetups={filtered} />}
        </>
      )}
    </div>
  )
}
