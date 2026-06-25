import { Link } from 'react-router-dom'
import type { GroupListItem } from '@/api/schemas'
import { brandGradient, initials } from '@/lib/gradient'

/** Schmale Gruppen-Kachel für den horizontalen Dashboard-Scroll. */
export function GroupMiniCard({ group }: { group: GroupListItem }) {
  return (
    <Link to={`/gruppen/${group.id}`} className="block w-40 shrink-0">
      <div className="overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-card transition hover:shadow-hover">
        <div
          className="grid h-20 place-items-center font-display text-xl font-bold text-white"
          style={{ background: brandGradient(group.name) }}
        >
          {initials(group.name)}
        </div>
        <div className="p-3">
          <div className="truncate font-semibold leading-tight">{group.name}</div>
          <div className="mt-0.5 text-xs text-base-content/55">{group.members_count} Mitglieder</div>
        </div>
      </div>
    </Link>
  )
}
