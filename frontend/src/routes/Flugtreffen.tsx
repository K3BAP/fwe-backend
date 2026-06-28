import { type ReactNode, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMeetups, type MeetupListParams } from '@/api/meetups'
import { useSpots } from '@/api/spots'
import { MeetupCard } from '@/components/meetups/MeetupCard'
import { MeetupFilters, type MeetupFilterState } from '@/components/meetups/MeetupFilters'
import { MeetupListRow } from '@/components/meetups/MeetupListRow'
import { MeetupMap } from '@/components/meetups/MeetupMap'
import { MeetupTable } from '@/components/meetups/MeetupTable'
import { EmptyState, Pager, SegmentedControl, Skeleton, type SegmentOption } from '@/components/ui'
import { PlusIcon, WingIcon } from '@/components/layout/icons'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { useMeetupViewStore, type MeetupView } from '@/stores/meetupViewStore'

const PAGE_SIZE = 12
const MAP_LIMIT = 200 // Karte/Desktop-Liste laden alle Treffen ohne Pager (§5)
const DEFAULT_SORT = 'starts_at_asc'

const VIEW_ICON: Record<MeetupView, ReactNode> = {
  cards: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  map: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 4v16M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z" />
    </svg>
  ),
  table: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  ),
}

const VIEW_OPTIONS: SegmentOption<MeetupView>[] = [
  { value: 'cards', label: <>{VIEW_ICON.cards} Cards</> },
  { value: 'map', label: <>{VIEW_ICON.map} Karte</> },
  { value: 'table', label: <>{VIEW_ICON.table} Tabelle</> },
]

/**
 * Flugtreffen-Übersicht. **Desktop:** persistenter Liste+Karte-Split (Prototyp). **Mobile/Tablet:**
 * Cards/Karte/Tabelle-Umschalter. Filter/Sortierung/Seite leben in der URL (teilbar); Region-Optionen
 * werden aus den Spots abgeleitet. Suche/Filter/Sortierung/Pagination laufen serverseitig (§6).
 */
export function Flugtreffen() {
  const [params, setParams] = useSearchParams()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
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

  const { data: spots } = useSpots()
  const regions = useMemo(
    () => [...new Set((spots ?? []).map((s) => s.region))].sort((a, b) => a.localeCompare(b, 'de')),
    [spots],
  )

  // Desktop-Liste und Karten-View zeigen alle Treffen (kein Pager); Cards/Tabelle paginieren serverseitig.
  const wantAll = isDesktop || view === 'map'
  const query: MeetupListParams = {
    q: filters.search || undefined,
    region: filters.region || undefined,
    level: filters.level || undefined,
    status: filters.status || undefined,
    has_free_spots: filters.freeOnly ? '1' : undefined,
    sort: filters.sort,
    limit: wantAll ? MAP_LIMIT : PAGE_SIZE,
    offset: wantAll ? 0 : (page - 1) * PAGE_SIZE,
  }
  const { data, isLoading, isError } = useMeetups(query)
  const items = data?.items ?? []
  const total = data?.total ?? 0

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

  const errorBox = (
    <p className="rounded-box bg-error/10 px-4 py-3 text-sm text-error">
      Flugtreffen konnten nicht geladen werden. Bitte später erneut versuchen.
    </p>
  )
  const emptyState = (
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
  )

  // ── Desktop: Liste + Karte ────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div className="flex h-full min-h-0">
        <aside className="flex w-[44%] min-w-0 max-w-[600px] flex-col border-r border-base-300">
          <div className="flex-shrink-0 space-y-3 px-6 pb-3 pt-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl">Flugtreffen</h1>
                <p className="text-sm text-base-content/55">{isLoading ? 'Lädt…' : `${total} Treffen in deiner Region`}</p>
              </div>
              <Link to="/flugtreffen/neu" className="btn btn-primary btn-sm shrink-0 rounded-full">
                <PlusIcon size={16} /> Neu
              </Link>
            </div>
            <MeetupFilters value={filters} onChange={patchFilters} regions={regions} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-1">
            {isError && errorBox}
            {isLoading && (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[104px]" />)}
              </div>
            )}
            {!isLoading && !isError && items.length === 0 && emptyState}
            {!isLoading && !isError && items.length > 0 && (
              <div className="flex flex-col gap-3">
                {items.map((m) => <MeetupListRow key={m.id} meetup={m} />)}
              </div>
            )}
          </div>
        </aside>
        <div className="min-h-0 flex-1">
          <MeetupMap meetups={items} className="h-full rounded-none border-0" />
        </div>
      </div>
    )
  }

  // ── Mobile/Tablet: Umschalter ─────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto px-4 py-6 pb-24 md:pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl">Flugtreffen</h1>
          <p className="mt-1 text-base-content/60">Finde gemeinsame Flugtage in deiner Region.</p>
        </div>
        <Link to="/flugtreffen/neu" className="btn btn-primary rounded-full shadow-[0_8px_18px_rgba(30,144,230,.3)]">
          <PlusIcon size={18} /> Treffen erstellen
        </Link>
      </div>

      <div className="mt-6">
        <MeetupFilters value={filters} onChange={patchFilters} regions={regions} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-base-content/55">{isLoading ? 'Lädt…' : `${total} Treffen`}</span>
        <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} aria-label="Ansicht" />
      </div>

      <div className="mt-5 flex flex-col gap-5">
        {isError && errorBox}
        {isLoading && (
          <div className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-72" />)}
          </div>
        )}
        {!isLoading && !isError && items.length === 0 && emptyState}
        {!isLoading && !isError && items.length > 0 && (
          <>
            {view === 'cards' && (
              <div className="grid gap-5 sm:grid-cols-2">
                {items.map((m) => <MeetupCard key={m.id} meetup={m} />)}
              </div>
            )}
            {view === 'table' && <MeetupTable meetups={items} sort={filters.sort} onSort={(sort) => patchFilters({ sort })} />}
            {view === 'map' && <MeetupMap meetups={items} />}
            {view !== 'map' && <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={goToPage} />}
          </>
        )}
      </div>
    </div>
  )
}
