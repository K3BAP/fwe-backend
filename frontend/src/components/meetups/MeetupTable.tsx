import { Link } from 'react-router-dom'
import { ExperienceBadge, StatusBadge } from '@/components/ui'
import type { MeetupListItem } from '@/api/schemas'
import { formatMeetupDate } from '@/lib/format'

/** Tabellen-Ansicht der Flugtreffen-Übersicht. Auf Mobile horizontal scrollbar. */
export function MeetupTable({ meetups }: { meetups: MeetupListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
      <table className="table">
        <thead>
          <tr className="text-base-content/60">
            <th>Treffen</th>
            <th className="hidden sm:table-cell">Region</th>
            <th className="whitespace-nowrap">Datum</th>
            <th className="hidden md:table-cell">Level</th>
            <th>Plätze</th>
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
