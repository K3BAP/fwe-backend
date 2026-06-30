import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGroups } from '@/api/groups'
import { GroupCard } from '@/components/groups/GroupCard'
import { EmptyState, SelectField, Skeleton, Stagger, StaggerItem, TextField } from '@/components/ui'
import { GroupIcon, PlusIcon } from '@/components/layout/icons'

/** Gruppen-Verzeichnis: Suche + Region-Filter, Grid aus GroupCards (private bleiben verborgen). */
export function Gruppen() {
  const { data, isLoading, isError } = useGroups()
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('')

  const regions = useMemo(
    () => [...new Set((data ?? []).map((g) => g.region).filter((r): r is string => Boolean(r)))].sort((a, b) => a.localeCompare(b, 'de')),
    [data],
  )

  const filtered = useMemo(() => {
    return (data ?? []).filter((g) => {
      const haystack = `${g.name} ${g.description ?? ''} ${g.region ?? ''} ${(g.tags ?? []).join(' ')}`.toLowerCase()
      if (search && !haystack.includes(search.toLowerCase())) return false
      if (region && g.region !== region) return false
      return true
    })
  }, [data, search, region])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl">Gruppen</h1>
          <p className="mt-1 text-base-content/60">Communities & Vereine in deiner Region.</p>
        </div>
        <Link to="/gruppen/neu" className="btn btn-primary rounded-full shadow-[0_8px_18px_rgba(30,144,230,.3)]">
          <PlusIcon size={18} /> Gruppe erstellen
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Suche" placeholder="Name, Tag oder Region…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <SelectField label="Region" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">Alle Regionen</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </SelectField>
      </div>

      {isError && (
        <p className="rounded-box bg-error/10 px-4 py-3 text-sm text-error">Gruppen konnten nicht geladen werden.</p>
      )}

      {isLoading && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-56" />)}
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState
          icon={<GroupIcon size={26} />}
          title="Keine Gruppen gefunden"
          description="Passe die Suche an oder gründe die erste Gruppe."
          action={
            <Link to="/gruppen/neu" className="btn btn-primary btn-sm rounded-full">
              Gruppe erstellen
            </Link>
          }
        />
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g) => (
            <StaggerItem key={g.id}>
              <GroupCard group={g} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  )
}
