import { Link } from 'react-router-dom'
import { Marker, Popup } from 'react-leaflet'
import { MapShell } from '@/components/map/MapShell'
import { pinIcon } from '@/components/map/pin'
import type { MeetupListItem } from '@/api/schemas'

/** Karten-Ansicht der Übersicht: ein Marker je verortetem Treffen, Popup verlinkt aufs Detail. */
export function MeetupMap({ meetups }: { meetups: MeetupListItem[] }) {
  const located = meetups.filter((m) => m.lat != null && m.lng != null)
  return (
    <MapShell className="h-[60vh] min-h-[420px]">
      {located.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat as number, m.lng as number]}
          icon={pinIcon(m.derived_status === 'cancelled' || m.derived_status === 'finished' ? 'coral' : 'sky')}
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
