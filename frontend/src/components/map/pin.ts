import { divIcon } from 'leaflet'

/**
 * Tropfenförmiger Marker in Brand-Farben (Sky-Standard, Coral z.B. für beendete/abgesagte Treffen) als
 * Leaflet-DivIcon. `selected` hebt den Marker unabhängig von der Statusfarbe hervor (größer + weißer
 * Rand + Schatten), damit ein Klick auf der Karte klar mit der Liste korrespondiert. Eigene Pin-Icons
 * vermeiden das Default-Icon-Asset-Problem unter Vite; eigene Datei (kein Komponenten-Export), damit
 * Fast-Refresh in `MapShell` sauber bleibt.
 */
export function pinIcon(color: 'sky' | 'coral' = 'sky', selected = false) {
  const fill = color === 'coral' ? '#F1572F' : '#1E90E6'
  const w = selected ? 38 : 28
  const h = selected ? 48 : 36
  const stroke = selected ? '<path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 22 14 22s14-12.5 14-22C28 6.27 21.73 0 14 0z" fill="none" stroke="#fff" stroke-width="2.5"/>' : ''
  const filter = selected ? 'filter:drop-shadow(0 6px 8px rgba(16,40,70,.4))' : ''

  return divIcon({
    className: '',
    iconSize: [w, h],
    iconAnchor: [w / 2, h - 2],
    popupAnchor: [0, -h + 6],
    html: `<svg width="${w}" height="${h}" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" style="${filter}">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 22 14 22s14-12.5 14-22C28 6.27 21.73 0 14 0z" fill="${fill}"/>
      ${stroke}
      <circle cx="14" cy="14" r="5" fill="#fff"/></svg>`,
  })
}
