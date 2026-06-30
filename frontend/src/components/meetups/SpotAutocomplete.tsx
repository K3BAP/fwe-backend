import { useMemo, useState } from 'react'
import { useSpots } from '@/api/spots'
import { Field, Popover } from '@/components/ui'
import { fieldControlClass } from '@/components/ui/fieldControl'
import type { Spot } from '@/api/schemas'

/** Tippsuche über die Startplätze (Naht: useSpots). Wählt einen Spot → onSelect(spot). */
export function SpotAutocomplete({
  label,
  value,
  onSelect,
  error,
}: {
  label?: string
  value: string
  onSelect: (spot: Spot) => void
  error?: string
}) {
  const { data: spots } = useSpots()
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = spots ?? []
    if (!q) return all.slice(0, 6)
    return all.filter((s) => s.name.toLowerCase().includes(q) || s.region.toLowerCase().includes(q)).slice(0, 6)
  }, [spots, query])

  return (
    <Field label={label} error={error}>
      <div className="relative">
        <input
          className={fieldControlClass(error)}
          placeholder="Startplatz suchen…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoComplete="off"
        />
        <Popover open={open && results.length > 0} origin="top" className="absolute z-20 mt-1 w-full">
          <ul className="max-h-60 w-full overflow-auto rounded-2xl border border-base-300 bg-base-100 p-1 shadow-popover">
            {results.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(s)
                    setQuery(s.name)
                    setOpen(false)
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-base-200"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="shrink-0 text-xs text-base-content/50">{s.region}</span>
                </button>
              </li>
            ))}
          </ul>
        </Popover>
      </div>
    </Field>
  )
}
