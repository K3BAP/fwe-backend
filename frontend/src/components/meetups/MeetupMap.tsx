import { Link } from 'react-router-dom'
import { Marker, Popup } from 'react-leaflet'
import { MapShell } from '@/components/map/MapShell'
import { pinIcon } from '@/components/map/pin'
import type { MeetupListItem } from '@/api/schemas'

/**
 * Karten-Ansicht der Übersicht: ein Marker je verortetem Treffen, Popup verlinkt aufs Detail.
 * `className` überschreibt die Standardhöhe (z.B. `h-full rounded-none` im Desktop-Split).
 * `selectedId`/`onSelect` koppeln die Karte an die Liste: ein Marker-Klick wählt das Treffen aus
 * (hervorgehobener Pin) und meldet es zurück.
 */
export function MeetupMap({
  meetups,
  className,
  selectedId,
  onSelect,
}: {
  meetups: MeetupListItem[]
  className?: string
  selectedId?: number | null
  onSelect?: (id: number) => void
}) {
  const located = meetups.filter((m) => m.lat != null && m.lng != null)
  return (
    <MapShell className={className ?? 'h-[60vh] min-h-[420px]'}>
      {located.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat as number, m.lng as number]}
          icon={pinIcon(m.derived_status === 'cancelled' || m.derived_status === 'finished' ? 'coral' : 'sky', selectedId === m.id)}
          zIndexOffset={selectedId === m.id ? 1000 : 0}
          eventHandlers={onSelect ? { click: () => onSelect(m.id) } : undefined}
        >
          <Popup>
            <Link to={`/flugtreffen/${m.id}`} className="font-semibold text-sky-700">
              {m.title}
            </Link>
            <div className="text-xs">
              {m.spot_name} · {m.region}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapShell>
  )
}
