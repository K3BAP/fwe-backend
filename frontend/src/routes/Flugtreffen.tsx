import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMeetups, type MeetupListParams } from '@/api/meetups'
import { useSpots } from '@/api/spots'
import { MeetupCard } from '@/components/meetups/MeetupCard'
import { MeetupFilters, type MeetupFilterState } from '@/components/meetups/MeetupFilters'
import { MeetupMap } from '@/components/meetups/MeetupMap'
import { MeetupTable } from '@/components/meetups/MeetupTable'
import { EmptyState, Pager, SegmentedControl, Skeleton, type SegmentOption } from '@/components/ui'
import { PlusIcon, WingIcon } from '@/components/layout/icons'
import { useMeetupViewStore, type MeetupView } from '@/stores/meetupViewStore'

const VIEW_OPTIONS: SegmentOption<MeetupView>[] = [
  { value: 'cards', label: 'Cards' },
  { value: 'table', label: 'Tabelle' },
  { value: 'map', label: 'Karte' },
]
const PAGE_SIZE = 12
const MAP_LIMIT = 200 // Karte zeigt alle Marker ohne Pager (§5)
const DEFAULT_SORT = 'starts_at_asc'

/**
 * Flugtreffen-Übersicht: Cards/Tabelle/Karte-Umschalter mit **serverseitiger** Suche/Filter/Sortierung/
 * Pagination (§6). Filter-/Sortier-/Seitenzustand lebt in der URL (teilbar, überlebt Reloads); die
 * Ansicht ist persistierter Client-State. Region-Optionen werden aus den Spots abgeleitet.
 */
export function Flugtreffen() {
  const [params, setParams] = useSearchParams()
  const view = useMeetupViewStore((s) => s.view)
  const setView = useMeetupViewStore((s) => s.setView)

  const filters: MeetupFilterState = {
    search: params.get('q') ?? '',
    region: params.get('region') ?? '',
    level: params.get('level') ?? '',
    status: params.get('status') ?? '',
    sort: params.get('sort') ?? DEFAULT_SORT,
    freeOnly: params.get('free') === '1',
  }
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)

  // Region-Optionen aus den (statischen) Spots ableiten — kein eigener /regions-Endpunkt.
  const { data: spots } = useSpots()
  const regions = useMemo(
    () => [...new Set((spots ?? []).map((s) => s.region))].sort((a, b) => a.localeCompare(b, 'de')),
    [spots],
  )

  const query: MeetupListParams = {
    q: filters.search || undefined,
    region: filters.region || undefined,
    level: filters.level || undefined,
    status: filters.status || undefined,
    has_free_spots: filters.freeOnly ? '1' : undefined,
    sort: filters.sort,
    limit: view === 'map' ? MAP_LIMIT : PAGE_SIZE,
    offset: view === 'map' ? 0 : (page - 1) * PAGE_SIZE,
  }
  const { data, isLoading, isError } = useMeetups(query)
  const items = data?.items ?? []
  const total = data?.total ?? 0

  /** Filter/Sortierung setzen — springt auf Seite 1 zurück (page wird verworfen). */
  function patchFilters(patch: Partial<MeetupFilterState>) {
    const next = { ...filters, ...patch }
    const sp = new URLSearchParams()
    if (next.search) sp.set('q', next.search)
    if (next.region) sp.set('region', next.region)
    if (next.level) sp.set('level', next.level)
    if (next.status) sp.set('status', next.status)
    if (next.freeOnly) sp.set('free', '1')
    if (next.sort && next.sort !== DEFAULT_SORT) sp.set('sort', next.sort)
    setParams(sp, { replace: true })
  }

  function goToPage(p: number) {
    const sp = new URLSearchParams(params)
    if (p <= 1) sp.delete('page')
    else sp.set('page', String(p))
    setParams(sp, { replace: true })
  }

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

      <MeetupFilters value={filters} onChange={patchFilters} regions={regions} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-base-content/55">{isLoading ? 'Lädt…' : `${total} Treffen`}</span>
        <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} aria-label="Ansicht" />
      </div>

      {isError && (
        <p className="rounded-box bg-error/10 px-4 py-3 text-sm text-error">
          Flugtreffen konnten nicht geladen werden. Bitte später erneut versuchen.
        </p>
      )}

      {isLoading && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
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

      {!isLoading && !isError && items.length > 0 && (
        <>
          {view === 'cards' && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((m) => (
                <MeetupCard key={m.id} meetup={m} />
              ))}
            </div>
          )}
          {view === 'table' && <MeetupTable meetups={items} sort={filters.sort} onSort={(sort) => patchFilters({ sort })} />}
          {view === 'map' && <MeetupMap meetups={items} />}

          {view !== 'map' && <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={goToPage} />}
        </>
      )}
    </div>
  )
}
