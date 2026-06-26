import { SelectField, Switch, TextField } from '@/components/ui'

export type MeetupFilterState = { search: string; region: string; level: string; freeOnly: boolean }

const LEVELS = [
  { value: 'beginner', label: 'Anfänger' },
  { value: 'advanced', label: 'Fortgeschritten' },
  { value: 'expert', label: 'Experte' },
  { value: 'all', label: 'Alle Level' },
]

/** Such-/Filterleiste der Flugtreffen-Übersicht (client-seitig auf den Mock-Daten). */
export function MeetupFilters({
  value,
  onChange,
  regions,
}: {
  value: MeetupFilterState
  onChange: (patch: Partial<MeetupFilterState>) => void
  regions: string[]
}) {
  return (
    <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <TextField
        label="Suche"
        placeholder="Titel, Spot oder Region…"
        value={value.search}
        onChange={(e) => onChange({ search: e.target.value })}
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
      <div className="pb-3">
        <Switch checked={value.freeOnly} onChange={(v) => onChange({ freeOnly: v })} label="Nur freie Plätze" />
      </div>
    </div>
  )
}
