import { Link } from 'react-router-dom'
import { Card } from '@/components/ui'
import type { GroupListItem } from '@/api/schemas'
import { brandGradient, initials } from '@/lib/gradient'
import { VisibilityBadge } from './GroupBadges'

/** Verzeichnis-Card einer Gruppe. Verlinkt auf die Gruppendetailseite. */
export function GroupCard({ group }: { group: GroupListItem }) {
  return (
    <Link to={`/gruppen/${group.id}`} className="group block h-full">
      <Card className="flex h-full flex-col overflow-hidden transition group-hover:shadow-hover">
        <div className="relative h-24" style={{ background: brandGradient(group.name) }}>
          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-display text-2xl font-bold text-white drop-shadow">
            {initials(group.name)}
          </span>
          <span className="absolute right-3 top-3">
            <VisibilityBadge visibility={group.visibility} />
          </span>
        </div>
        <div className="flex flex-1 flex-col p-4">
          <h3 className="font-display text-lg leading-tight">{group.name}</h3>
          {group.region && <div className="mt-0.5 text-[13px] text-base-content/55">📍 {group.region}</div>}
          {group.description && <p className="mt-2 line-clamp-2 text-sm text-base-content/70">{group.description}</p>}
          <div className="mt-auto flex items-center justify-between pt-3">
            <span className="text-sm font-semibold text-base-content/70">{group.members_count} Mitglieder</span>
            <span className="text-sm font-semibold text-primary">Ansehen →</span>
          </div>
        </div>
      </Card>
    </Link>
  )
}
