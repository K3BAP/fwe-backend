import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Button, Input } from './ui'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const TRIER: [number, number] = [6.6439, 49.7596] // [lng, lat]
const CIRCLE_SOURCE = 'gps-radius'

/** Geodätischer Kreis als GeoJSON-Polygon (Meter-Radius, ~64 Stützpunkte). */
function geodesicCircle(lat: number, lng: number, radiusM: number, points = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = []
  const earth = 6371000
  const latR = (lat * Math.PI) / 180
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI
    const dLat = (radiusM * Math.cos(angle)) / earth
    const dLng = (radiusM * Math.sin(angle)) / (earth * Math.cos(latR))
    coords.push([lng + (dLng * 180) / Math.PI, lat + (dLat * 180) / Math.PI])
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} }
}

export function GpsTaskMap({
  lat,
  lng,
  radiusM,
  onChange,
}: {
  lat: number | null
  lng: number | null
  radiusM: number
  onChange: (next: { lat: number; lng: number }) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const loadedRef = useRef(false)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  // Karte einmalig initialisieren.
  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: lat != null && lng != null ? [lng, lat] : TRIER,
      zoom: lat != null && lng != null ? 15 : 13,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('click', (e) => onChangeRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }))

    map.on('load', () => {
      loadedRef.current = true
      map.addSource(CIRCLE_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'gps-radius-fill', type: 'fill', source: CIRCLE_SOURCE, paint: { 'fill-color': '#6366f1', 'fill-opacity': 0.18 } })
      map.addLayer({ id: 'gps-radius-line', type: 'line', source: CIRCLE_SOURCE, paint: { 'line-color': '#6366f1', 'line-width': 2 } })
      map.resize()
    })

    return () => {
      loadedRef.current = false
      markerRef.current?.remove()
      markerRef.current = null
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Marker + Kreis bei Änderung von Position/Radius aktualisieren.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      if (lat == null || lng == null) {
        markerRef.current?.remove()
        markerRef.current = null
        const src = map.getSource(CIRCLE_SOURCE) as maplibregl.GeoJSONSource | undefined
        src?.setData({ type: 'FeatureCollection', features: [] })
        return
      }

      if (!markerRef.current) {
        const marker = new maplibregl.Marker({ draggable: true, color: '#6366f1' })
          .setLngLat([lng, lat])
          .addTo(map)
        marker.on('dragend', () => {
          const p = marker.getLngLat()
          onChangeRef.current({ lat: p.lat, lng: p.lng })
        })
        markerRef.current = marker
      } else {
        markerRef.current.setLngLat([lng, lat])
      }

      const src = map.getSource(CIRCLE_SOURCE) as maplibregl.GeoJSONSource | undefined
      src?.setData(geodesicCircle(lat, lng, radiusM))
    }

    if (loadedRef.current) apply()
    else map.once('load', apply)
  }, [lat, lng, radiusM])

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setSearchError('')
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de&q=${encodeURIComponent(q)}`
      const res = await fetch(url, { headers: { 'Accept-Language': 'de' } })
      const hits = (await res.json()) as Array<{ lat: string; lon: string }>
      if (!hits.length) {
        setSearchError('Ort nicht gefunden.')
        return
      }
      const found = { lat: Number(hits[0].lat), lng: Number(hits[0].lon) }
      mapRef.current?.flyTo({ center: [found.lng, found.lat], zoom: 16 })
      onChange(found)
    } catch {
      setSearchError('Suche fehlgeschlagen.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="space-y-2">
      <form onSubmit={search} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ort suchen (z. B. Trier Hauptmarkt)"
        />
        <Button type="submit" variant="secondary" loading={searching}>
          Suchen
        </Button>
      </form>
      {searchError && <p className="text-sm font-medium text-red-600 dark:text-red-400">{searchError}</p>}
      <div ref={containerRef} className="h-64 w-full overflow-hidden rounded-xl ring-1 ring-line" />
    </div>
  )
}
