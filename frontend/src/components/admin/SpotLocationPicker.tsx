import type { LatLngLiteral, Marker as LeafletMarker } from 'leaflet'
import { Marker, useMapEvents } from 'react-leaflet'
import { MapShell } from '@/components/map/MapShell'
import { pinIcon } from '@/components/map/pin'
import { Field } from '@/components/ui'

/** Startbild ohne gesetzten Punkt: Nordalpen/Voralpen — dort liegt der Großteil der Startplätze. */
const DACH_CENTER: [number, number] = [47.6, 11.5]

/**
 * Nimmt Klicks auf der Karte entgegen. `useMapEvents` funktioniert nur **innerhalb** des
 * MapContainer, deshalb eine eigene Kind-Komponente ohne eigenes Markup.
 */
function ClickCatcher({ onPick }: { onPick: (position: LatLngLiteral) => void }) {
  useMapEvents({
    // `wrap()` holt den Längengrad zurück nach −180…180. Ohne das liefert Leaflet nach mehrfachem
    // Panning über den Kartenrand Werte wie 372 — die Spalte ist DECIMAL(9,6), der Server lehnte ab.
    click: (e) => onPick(e.latlng.wrap()),
  })
  return null
}

/**
 * Setzt die Lage eines Startplatzes auf der Karte statt über zwei Zahlenfelder — Koordinaten von Hand
 * einzutippen ist für einen Berg kaum zumutbar. Bewusst **ohne** Ortssuche: Geocoding wäre ein
 * dritter externer Dienst (bisher nur Open-Meteo und Gemini, siehe ADR-017/018) und damit eine
 * eigene Entscheidung.
 */
export function SpotLocationPicker({
  position,
  onPick,
  error,
}: {
  position: LatLngLiteral | null
  onPick: (position: LatLngLiteral) => void
  error?: string
}) {
  return (
    <Field label="Lage" error={error}>
      <MapShell className="h-80" center={position ? [position.lat, position.lng] : DACH_CENTER} zoom={position ? 12 : 6}>
        <ClickCatcher onPick={onPick} />
        {position && (
          <Marker
            position={position}
            icon={pinIcon('sky', true)}
            draggable
            eventHandlers={{ dragend: (e) => onPick((e.target as LeafletMarker).getLatLng().wrap()) }}
          />
        )}
      </MapShell>
      <p className="text-xs text-base-content/60">
        {position ? (
          <>
            Marker ziehen oder erneut klicken, um die Lage anzupassen ·{' '}
            <span className="font-mono">
              {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
            </span>
          </>
        ) : (
          'Klicke auf die Karte, um den Startplatz zu setzen.'
        )}
      </p>
    </Field>
  )
}
