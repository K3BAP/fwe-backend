import type { AdminSpot } from '@/api/schemas'
import { Menu, Pill, SortHeader, Table, type MenuItemDef } from '@/components/ui'
import { SPOT_TYPE_LABEL } from './spotLabels'

/** Tabelle der Startplatz-Pflege. `meetups_count` steht hier, weil es der Löschen-Dialog braucht. */
export function AdminSpotTable({
  spots,
  sort,
  onSort,
  actionsFor,
}: {
  spots: AdminSpot[]
  sort?: string
  onSort?: (sort: string) => void
  actionsFor: (spot: AdminSpot) => MenuItemDef[]
}) {
  return (
    <Table>
      <thead>
        <tr className="text-base-content/60">
          <SortHeader label="Name" sortKey="name_asc" active={sort === 'name_asc'} indicator="▲" onSort={onSort} />
          <SortHeader label="Region" sortKey="region_asc" active={sort === 'region_asc'} indicator="▲" onSort={onSort} />
          <th className="hidden sm:table-cell">Land</th>
          <th className="hidden md:table-cell">Typ</th>
          <th className="hidden lg:table-cell whitespace-nowrap">Koordinaten</th>
          <th className="hidden sm:table-cell">Treffen</th>
          <th className="w-12" />
        </tr>
      </thead>
      <tbody>
        {spots.map((spot) => (
          <tr key={spot.id} className="hover:bg-base-200">
            <td className="font-semibold">{spot.name}</td>
            <td className="text-base-content/70">{spot.region}</td>
            <td className="hidden sm:table-cell text-base-content/70">{spot.country}</td>
            <td className="hidden md:table-cell">
              <Pill tone="neutral">{SPOT_TYPE_LABEL[spot.type]}</Pill>
            </td>
            <td className="hidden lg:table-cell whitespace-nowrap font-mono text-xs text-base-content/60">
              {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}
            </td>
            <td className="hidden sm:table-cell">{spot.meetups_count}</td>
            <td>
              <Menu items={actionsFor(spot)} label={`Aktionen für ${spot.name}`} />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
