import { divIcon } from 'leaflet'

/**
 * Tropfenförmiger Marker in Brand-Farben (Sky-Standard, Coral für Auswahl) als Leaflet-DivIcon.
 * Eigene Pin-Icons vermeiden das Default-Icon-Asset-Problem unter Vite. Eigene Datei (kein
 * Komponenten-Export), damit Fast-Refresh in `MapShell` sauber bleibt.
 */
export function pinIcon(color: 'sky' | 'coral' = 'sky') {
  const fill = color === 'coral' ? '#F1572F' : '#1E90E6'
  return divIcon({
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    popupAnchor: [0, -30],
    html: `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 22 14 22s14-12.5 14-22C28 6.27 21.73 0 14 0z" fill="${fill}"/>
      <circle cx="14" cy="14" r="5" fill="#fff"/></svg>`,
  })
}
