import { Link } from 'react-router-dom'
import type { AdminGroupRow } from '@/api/schemas'
import { Menu, Pill, SortHeader, Table, type MenuItemDef } from '@/components/ui'
import { formatDate } from '@/lib/format'

const VISIBILITY_LABEL: Record<AdminGroupRow['visibility'], string> = {
  public: 'Öffentlich',
  unlisted: 'Nicht gelistet',
  private: 'Privat',
}

const JOIN_POLICY_LABEL: Record<AdminGroupRow['join_policy'], string> = {
  open: 'Offen',
  request: 'Auf Anfrage',
  invite_only: 'Nur mit Einladung',
}

/** Tabelle der Gruppen-Verwaltung — zeigt **alle** Gruppen, auch private und gelöschte. */
export function AdminGroupTable({
  groups,
  sort,
  onSort,
  actionsFor,
}: {
  groups: AdminGroupRow[]
  sort?: string
  onSort?: (sort: string) => void
  actionsFor: (group: AdminGroupRow) => MenuItemDef[]
}) {
  return (
    <Table>
      <thead>
        <tr className="text-base-content/60">
          <SortHeader label="Gruppe" sortKey="name_asc" active={sort === 'name_asc'} indicator="▲" onSort={onSort} />
          <th className="hidden lg:table-cell">Eigentümer</th>
          <th className="hidden sm:table-cell">Sichtbarkeit</th>
          <th className="hidden xl:table-cell">Beitritt</th>
          <SortHeader
            label="Mitglieder"
            sortKey="members_desc"
            active={sort === 'members_desc'}
            indicator="▼"
            onSort={onSort}
            className="hidden sm:table-cell"
          />
          <SortHeader
            label="Erstellt"
            sortKey="created_at_desc"
            active={sort === 'created_at_desc'}
            indicator="▼"
            onSort={onSort}
            className="hidden md:table-cell whitespace-nowrap"
          />
          <th>Status</th>
          <th className="w-12" />
        </tr>
      </thead>
      <tbody>
        {groups.map((group) => (
          <tr key={group.id} className="hover:bg-base-200">
            <td>
              <Link to={`/gruppen/${group.id}`} className="font-semibold hover:text-primary">
                {group.name}
              </Link>
              <div className="text-xs text-base-content/55">/{group.slug}</div>
            </td>
            <td className="hidden lg:table-cell text-base-content/70">{group.owner?.display_name ?? '—'}</td>
            <td className="hidden sm:table-cell">
              <Pill tone={group.visibility === 'private' ? 'warning' : 'neutral'}>{VISIBILITY_LABEL[group.visibility]}</Pill>
            </td>
            <td className="hidden xl:table-cell text-base-content/70">{JOIN_POLICY_LABEL[group.join_policy]}</td>
            <td className="hidden sm:table-cell">{group.members_count}</td>
            <td className="hidden md:table-cell whitespace-nowrap text-base-content/70">
              {group.created_at ? formatDate(group.created_at) : '—'}
            </td>
            <td>
              <Pill tone={group.deleted_at ? 'error' : 'success'}>{group.deleted_at ? 'Gelöscht' : 'Aktiv'}</Pill>
            </td>
            <td>
              <Menu items={actionsFor(group)} label={`Aktionen für ${group.name}`} />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
