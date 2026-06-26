import { Menu, UserCard, type MenuItemDef } from '@/components/ui'
import type { GroupMember, GroupRole } from '@/api/schemas'
import { ProfileHovercard } from '@/components/profile/ProfileHovercard'

const ROLE_LABEL: Record<GroupRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  moderator: 'Moderator',
  member: 'Mitglied',
}

function Badges({ m }: { m: GroupMember }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {m.status === 'banned' && (
        <span className="rounded-full bg-error/15 px-2.5 py-1 text-xs font-semibold text-error">Gebannt</span>
      )}
      {m.role !== 'member' && (
        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">{ROLE_LABEL[m.role]}</span>
      )}
    </span>
  )
}

/** Mitgliederliste mit Rollen/Status; `actions` blendet pro Mitglied ein Verwaltungs-Menü ein. */
export function MemberList({
  members,
  actions,
}: {
  members: GroupMember[]
  actions?: (m: GroupMember) => MenuItemDef[]
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-2">
      {members.map((m) => {
        const items = actions?.(m) ?? []
        return (
          <div key={m.user.id} className="flex items-center gap-1">
            <ProfileHovercard userId={m.user.id} className="min-w-0 flex-1">
              <UserCard user={m.user} highlight={m.role === 'owner'} trailing={<Badges m={m} />} />
            </ProfileHovercard>
            {items.length > 0 && <Menu items={items} label="Mitglied" />}
          </div>
        )
      })}
    </div>
  )
}
