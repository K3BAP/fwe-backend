import type { ReactNode } from 'react'
import { Card } from '@/components/ui'
import type { GroupDetail } from '@/api/schemas'
import { brandGradient } from '@/lib/gradient'
import { JoinPolicyBadge, VisibilityBadge } from './GroupBadges'

/** Detail-Hero einer Gruppe: Verlaufsbanner, Name/Region/Mitglieder + Aktionsleiste. */
export function GroupHero({ group, action }: { group: GroupDetail; action?: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="relative h-36 sm:h-44" style={{ background: brandGradient(group.name) }}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <span className="absolute right-4 top-4">
          <VisibilityBadge visibility={group.visibility} />
        </span>
        <div className="absolute inset-x-4 bottom-4 text-white">
          <h1 className="font-display text-2xl font-bold drop-shadow sm:text-3xl">{group.name}</h1>
          <div className="mt-1 text-sm text-white/85">
            {group.region ? `📍 ${group.region} · ` : ''}
            {group.members_count} Mitglieder
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <JoinPolicyBadge policy={group.join_policy} />
        {group.tags?.map((t) => (
          <span key={t} className="rounded-full bg-base-200 px-3 py-1.5 text-[13px] font-medium text-base-content/70">
            #{t}
          </span>
        ))}
        {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
      </div>
    </Card>
  )
}
