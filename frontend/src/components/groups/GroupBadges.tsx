import { Pill } from '@/components/ui'
import type { GroupJoinPolicy, GroupVisibility } from '@/api/schemas'

const VIS: Record<GroupVisibility, { label: string; bg: string; fg: string }> = {
  public: { label: 'Öffentlich', bg: '#E4F6EC', fg: '#157A43' },
  unlisted: { label: 'Nicht gelistet', bg: '#EEF3F9', fg: '#5B6B7E' },
  private: { label: 'Privat', bg: '#FBF0D6', fg: '#8A5D00' },
}

export function VisibilityBadge({ visibility }: { visibility: GroupVisibility }) {
  const v = VIS[visibility]
  return (
    <Pill bg={v.bg} fg={v.fg}>
      {v.label}
    </Pill>
  )
}

const POLICY: Record<GroupJoinPolicy, string> = {
  open: 'Direktbeitritt',
  request: 'Auf Antrag',
  invite_only: 'Nur Einladung',
}

export function JoinPolicyBadge({ policy }: { policy: GroupJoinPolicy }) {
  return (
    <span className="rounded-full bg-base-200 px-3 py-1.5 text-[13px] font-semibold text-base-content/70">
      {POLICY[policy]}
    </span>
  )
}
