import { useEffect, useState } from 'react'
import { SelectField, Switch, TextField } from '@/components/ui'

export type MeetupFilterState = {
  search: string
  region: string
  level: string
  status: string
  sort: string
  freeOnly: boolean
}

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
  { value: 'starts_at_asc', label: 'Datum (nächste zuerst)' },
  { value: 'starts_at_desc', label: 'Datum (späteste zuerst)' },
  { value: 'participants_desc', label: 'Beliebteste' },
  { value: 'title_asc', label: 'Titel (A–Z)' },
  { value: 'created_at_desc', label: 'Neueste' },
]

/** Such-/Filter-/Sortierleiste der Flugtreffen-Übersicht — wirkt serverseitig (§6). */
export function MeetupFilters({
  value,
  onChange,
  regions,
}: {
  value: MeetupFilterState
  onChange: (patch: Partial<MeetupFilterState>) => void
  regions: string[]
}) {
  // Suche wird lokal gehalten und entprellt, damit nicht jeder Tastendruck eine Abfrage auslöst.
  const [search, setSearch] = useState(value.search)
  // Externe Änderungen (z.B. geteilte URL) übernehmen — „adjust state during render" statt Effekt.
  const [syncedSearch, setSyncedSearch] = useState(value.search)
  if (value.search !== syncedSearch) {
    setSyncedSearch(value.search)
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
    <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <TextField
        label="Suche"
        placeholder="Titel, Spot oder Region…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <SelectField label="Region" value={value.region} onChange={(e) => onChange({ region: e.target.value })}>
        <option value="">Alle Regionen</option>
        {regions.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </SelectField>
      <SelectField label="Level" value={value.level} onChange={(e) => onChange({ level: e.target.value })}>
        <option value="">Alle Level</option>
        {LEVELS.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </SelectField>
      <SelectField label="Status" value={value.status} onChange={(e) => onChange({ status: e.target.value })}>
        <option value="">Alle Status</option>
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </SelectField>
      <SelectField label="Sortierung" value={value.sort} onChange={(e) => onChange({ sort: e.target.value })}>
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </SelectField>
      <div className="pb-3">
        <Switch checked={value.freeOnly} onChange={(v) => onChange({ freeOnly: v })} label="Nur freie Plätze" />
      </div>
    </div>
  )
}
