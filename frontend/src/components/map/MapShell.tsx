import 'leaflet/dist/leaflet.css'
import type { ReactNode } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import { cn } from '@/lib/cn'

/** Mittelpunkt ~geografische Mitte Deutschlands (für die Übersichtskarte). */
const GERMANY_CENTER: [number, number] = [50.9, 10.0]

/**
 * Leaflet-Wrapper (Design-System §Map). Kapselt MapContainer + OSM-Kacheln und reicht Marker als
 * `children` durch. Eigene Pin-Icons via `pinIcon` (siehe ./pin) vermeiden das Default-Icon-Asset-
 * Problem unter Vite.
 */
export function MapShell({
  center = GERMANY_CENTER,
  zoom = 6,
  className,
  children,
}: {
  center?: [number, number]
  zoom?: number
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn('overflow-hidden rounded-box border border-base-300', className)}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom className="size-full" style={{ minHeight: 320 }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {children}
      </MapContainer>
    </div>
  )
}
