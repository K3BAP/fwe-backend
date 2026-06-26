import { UserCard } from '@/components/ui'
import type { GroupMember, GroupRole } from '@/api/schemas'

const ROLE_LABEL: Record<GroupRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  moderator: 'Moderator',
  member: 'Mitglied',
}

function RoleBadge({ role }: { role: GroupRole }) {
  if (role === 'member') return null
  return (
    <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">{ROLE_LABEL[role]}</span>
  )
}

/** Mitgliederliste mit Rollen; Owner wird hervorgehoben. */
export function MemberList({ members }: { members: GroupMember[] }) {
  return (
    <div className="grid gap-1 sm:grid-cols-2">
      {members.map((m) => (
        <UserCard key={m.user.id} user={m.user} highlight={m.role === 'owner'} trailing={<RoleBadge role={m.role} />} />
      ))}
    </div>
  )
}
