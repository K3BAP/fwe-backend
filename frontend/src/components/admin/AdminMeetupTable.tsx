import { Link } from 'react-router-dom'
import type { AdminMeetupRow } from '@/api/schemas'
import { Menu, Pill, SortHeader, StatusBadge, Table, type MenuItemDef } from '@/components/ui'
import { formatMeetupDate } from '@/lib/format'

/**
 * Tabelle der Treffen-Verwaltung. Zeigt neben dem abgeleiteten Status auch den **persistierten** —
 * `full`/`finished` stehen nirgends in der DB, sie entstehen beim Lesen (ADR-002: kein Cron). Für den
 * Admin ist genau das relevant, wenn er sich fragt, warum ein Treffen „zu" ist.
 */
export function AdminMeetupTable({
  meetups,
  sort,
  onSort,
  actionsFor,
}: {
  meetups: AdminMeetupRow[]
  sort?: string
  onSort?: (sort: string) => void
  actionsFor: (meetup: AdminMeetupRow) => MenuItemDef[]
}) {
  const dateNext = sort === 'starts_at_asc' ? 'starts_at_desc' : 'starts_at_asc'
  const dateActive = sort === 'starts_at_asc' || sort === 'starts_at_desc'

  return (
    <Table>
      <thead>
        <tr className="text-base-content/60">
          <SortHeader label="Treffen" sortKey="title_asc" active={sort === 'title_asc'} indicator="▲" onSort={onSort} />
          <th className="hidden lg:table-cell">Ersteller</th>
          <SortHeader
            label="Datum"
            sortKey={dateNext}
            active={dateActive}
            indicator={sort === 'starts_at_desc' ? '▼' : '▲'}
            onSort={onSort}
            className="hidden sm:table-cell whitespace-nowrap"
          />
          <SortHeader
            label="Plätze"
            sortKey="participants_desc"
            active={sort === 'participants_desc'}
            indicator="▼"
            onSort={onSort}
            className="hidden sm:table-cell"
          />
          <th className="hidden md:table-cell">Gespeichert</th>
          <th>Status</th>
          <th className="w-12" />
        </tr>
      </thead>
      <tbody>
        {meetups.map((meetup) => (
          <tr key={meetup.id} className="hover:bg-base-200">
            <td>
              <Link to={`/flugtreffen/${meetup.id}`} className="font-semibold hover:text-primary">
                {meetup.title}
              </Link>
              <div className="text-xs text-base-content/55">
                📍 {meetup.spot_name ?? '—'}
                {meetup.region ? ` · ${meetup.region}` : ''}
              </div>
            </td>
            <td className="hidden lg:table-cell text-base-content/70">{meetup.creator?.display_name ?? '—'}</td>
            <td className="hidden sm:table-cell whitespace-nowrap">
              {meetup.starts_at ? formatMeetupDate(meetup.starts_at) : '—'}
            </td>
            <td className="hidden sm:table-cell whitespace-nowrap">
              {meetup.max_participants ? `${meetup.participant_count} / ${meetup.max_participants}` : meetup.participant_count}
            </td>
            <td className="hidden md:table-cell">
              <Pill tone="neutral">{meetup.status === 'cancelled' ? 'Abgesagt' : 'Offen'}</Pill>
            </td>
            <td>
              <StatusBadge status={meetup.derived_status} />
            </td>
            <td>
              <Menu items={actionsFor(meetup)} label={`Aktionen für ${meetup.title}`} />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
