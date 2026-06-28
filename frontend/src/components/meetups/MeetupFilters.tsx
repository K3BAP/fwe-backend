import { useEffect, useState } from 'react'
import { FilterPill } from '@/components/ui'
import { cn } from '@/lib/cn'

export type MeetupFilterState = {
  search: string
  region: string
  level: string
  status: string
  sort: string
  freeOnly: boolean
}

const DEFAULT_SORT = 'starts_at_asc'

const LEVELS = [
  { value: 'beginner', label: 'Anfänger' },
  { value: 'advanced', label: 'Fortgeschritten' },
  { value: 'expert', label: 'Experte' },
  { value: 'all', label: 'Alle Level' },
]

const STATUSES = [
  { value: 'open', label: 'Offen' },
  { value: 'full', label: 'Ausgebucht' },
  { value: 'finished', label: 'Beendet' },
  { value: 'cancelled', label: 'Abgesagt' },
]

const SORTS = [
  { value: 'starts_at_asc', label: 'Nächste zuerst' },
  { value: 'starts_at_desc', label: 'Späteste zuerst' },
  { value: 'participants_desc', label: 'Beliebteste' },
  { value: 'title_asc', label: 'Titel A–Z' },
  { value: 'created_at_desc', label: 'Neueste' },
]

/**
 * Such-/Filterleiste der Flugtreffen-Übersicht (Prototyp: Suchfeld + Pill-Dropdowns). Wirkt serverseitig
 * (§6); Status/Sortierung sind als kompakte Pills realisiert, „Nur freie" als Toggle. Geteilt von der
 * Desktop-Split-Spalte und der mobilen Ansicht.
 */
export function MeetupFilters({
  value,
  onChange,
  regions,
}: {
  value: MeetupFilterState
  onChange: (patch: Partial<MeetupFilterState>) => void
  regions: string[]
}) {
  // Suche lokal + entprellt, damit nicht jeder Tastendruck eine Abfrage auslöst.
  const [search, setSearch] = useState(value.search)
  const [synced, setSynced] = useState(value.search)
  if (value.search !== synced) {
    setSynced(value.search)
    setSearch(value.search)
  }
  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== value.search) onChange({ search })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bewusst nur auf `search` reagieren
  }, [search])

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2.5 rounded-[14px] border-[1.5px] border-base-300 bg-base-100 px-3.5 py-2.5 focus-within:border-primary">
        <svg className="size-[18px] shrink-0 text-base-content/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4-4" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Spot oder Region suchen…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-base-content/40"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <FilterPill aria-label="Region" active={!!value.region} value={value.region} onChange={(e) => onChange({ region: e.target.value })}>
          <option value="">Alle Regionen</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </FilterPill>
        <FilterPill aria-label="Level" active={!!value.level} value={value.level} onChange={(e) => onChange({ level: e.target.value })}>
          <option value="">Alle Level</option>
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </FilterPill>
        <FilterPill aria-label="Status" active={!!value.status} value={value.status} onChange={(e) => onChange({ status: e.target.value })}>
          <option value="">Alle Status</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </FilterPill>
        <FilterPill aria-label="Sortierung" active={value.sort !== DEFAULT_SORT} value={value.sort} onChange={(e) => onChange({ sort: e.target.value })}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </FilterPill>
        <button
          type="button"
          aria-pressed={value.freeOnly}
          onClick={() => onChange({ freeOnly: !value.freeOnly })}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition',
            value.freeOnly
              ? 'border-transparent bg-sky-50 text-sky-700'
              : 'border-base-300 bg-base-100 text-base-content/80 hover:bg-base-200',
          )}
        >
          {value.freeOnly && (
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
              <path d="M4 12l5 5L20 6" />
            </svg>
          )}
          Nur freie
        </button>
      </div>
    </div>
  )
}
