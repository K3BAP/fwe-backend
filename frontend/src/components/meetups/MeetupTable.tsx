import { Link } from 'react-router-dom'
import { ExperienceBadge, StatusBadge } from '@/components/ui'
import type { MeetupListItem } from '@/api/schemas'
import { formatMeetupDate } from '@/lib/format'

/** Sortierbarer Header: rendert einen Button, wenn `onSort` gesetzt ist, sonst reinen Text. */
function SortHeader({
  label,
  sortKey,
  active,
  indicator,
  onSort,
  className,
}: {
  label: string
  sortKey: string
  active: boolean
  indicator: string
  onSort?: (sort: string) => void
  className?: string
}) {
  if (!onSort) {
    return <th className={className}>{label}</th>
  }
  return (
    <th className={className}>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-semibold hover:text-primary"
        onClick={() => onSort(sortKey)}
        aria-pressed={active}
      >
        {label}
        {active && <span aria-hidden>{indicator}</span>}
      </button>
    </th>
  )
}

/** Tabellen-Ansicht der Flugtreffen-Übersicht. Header setzen den serverseitigen `sort`-Parameter. */
export function MeetupTable({
  meetups,
  sort,
  onSort,
}: {
  meetups: MeetupListItem[]
  sort?: string
  onSort?: (sort: string) => void
}) {
  // Datum togglet asc↔desc; die übrigen Spalten setzen ihren festen Sortierwert.
  const dateNext = sort === 'starts_at_asc' ? 'starts_at_desc' : 'starts_at_asc'
  const dateActive = sort === 'starts_at_asc' || sort === 'starts_at_desc'

  return (
    <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
      <table className="table">
        <thead>
          <tr className="text-base-content/60">
            <SortHeader label="Treffen" sortKey="title_asc" active={sort === 'title_asc'} indicator="▲" onSort={onSort} />
            <th className="hidden sm:table-cell">Region</th>
            <SortHeader
              label="Datum"
              sortKey={dateNext}
              active={dateActive}
              indicator={sort === 'starts_at_desc' ? '▼' : '▲'}
              onSort={onSort}
              className="whitespace-nowrap"
            />
            <th className="hidden md:table-cell">Level</th>
            <SortHeader label="Plätze" sortKey="participants_desc" active={sort === 'participants_desc'} indicator="▼" onSort={onSort} />
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {meetups.map((m) => (
            <tr key={m.id} className="hover:bg-base-200">
              <td>
                <Link to={`/flugtreffen/${m.id}`} className="font-semibold hover:text-primary">
                  {m.title}
                </Link>
                <div className="text-xs text-base-content/55">📍 {m.spot_name}</div>
              </td>
              <td className="hidden sm:table-cell">{m.region}</td>
              <td className="whitespace-nowrap">{formatMeetupDate(m.starts_at)}</td>
              <td className="hidden md:table-cell">
                <ExperienceBadge level={m.experience_level} />
              </td>
              <td className="whitespace-nowrap">
                {m.max_participants ? `${m.participant_count} / ${m.max_participants}` : m.participant_count}
              </td>
              <td>
                <StatusBadge status={m.derived_status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
