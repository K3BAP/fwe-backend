import type { AdminUserRow } from '@/api/schemas'
import { Menu, Pill, SortHeader, Table, UserCard, type MenuItemDef } from '@/components/ui'
import { formatDate, formatRelativeTime } from '@/lib/format'
import { userStatusTone } from './userStatus'

/** Tabelle der Benutzerverwaltung. Header setzen den serverseitigen `sort`-Parameter. */
export function AdminUserTable({
  users,
  sort,
  onSort,
  actionsFor,
}: {
  users: AdminUserRow[]
  sort?: string
  onSort?: (sort: string) => void
  actionsFor: (user: AdminUserRow) => MenuItemDef[]
}) {
  const dateNext = sort === 'created_at_desc' ? 'created_at_asc' : 'created_at_desc'
  const dateActive = sort === 'created_at_desc' || sort === 'created_at_asc'

  return (
    <Table>
      <thead>
        <tr className="text-base-content/60">
          <SortHeader label="Pilot" sortKey="name_asc" active={sort === 'name_asc'} indicator="▲" onSort={onSort} />
          <SortHeader label="E-Mail" sortKey="email_asc" active={sort === 'email_asc'} indicator="▲" onSort={onSort} className="hidden md:table-cell" />
          <SortHeader
            label="Registriert"
            sortKey={dateNext}
            active={dateActive}
            indicator={sort === 'created_at_asc' ? '▲' : '▼'}
            onSort={onSort}
            className="hidden lg:table-cell whitespace-nowrap"
          />
          <th className="hidden xl:table-cell whitespace-nowrap">Zuletzt aktiv</th>
          <th className="hidden sm:table-cell">Treffen</th>
          <th className="hidden sm:table-cell">Gruppen</th>
          <th>Status</th>
          <th className="w-12" />
        </tr>
      </thead>
      <tbody>
        {users.map((user) => {
          const status = userStatusTone(user)
          const actions = actionsFor(user)
          return (
            <tr key={user.id} className="hover:bg-base-200">
              <td>
                <UserCard
                  user={{ id: user.id, display_name: user.display_name, handle: user.handle, avatar_path: user.avatar_path }}
                  size={34}
                  trailing={user.is_admin ? <Pill tone="secondary">Admin</Pill> : undefined}
                />
              </td>
              <td className="hidden md:table-cell text-base-content/70">{user.email ?? '—'}</td>
              <td className="hidden lg:table-cell whitespace-nowrap text-base-content/70">
                {user.created_at ? formatDate(user.created_at) : '—'}
              </td>
              <td className="hidden xl:table-cell whitespace-nowrap text-base-content/70">
                {user.last_active ? formatRelativeTime(user.last_active) : 'Nie'}
              </td>
              <td className="hidden sm:table-cell">{user.meetups_count}</td>
              <td className="hidden sm:table-cell">{user.groups_count}</td>
              <td>
                <Pill tone={status.tone}>{status.label}</Pill>
              </td>
              <td>
                {/* Am eigenen Konto bleibt nichts übrig (alles selbstgeschützt) — dann gar kein
                    Kebab, statt eines Menüs, das sich leer öffnet. */}
                {actions.length > 0 && <Menu items={actions} label={`Aktionen für ${user.display_name}`} />}
              </td>
            </tr>
          )
        })}
      </tbody>
    </Table>
  )
}
