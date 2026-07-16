import type { AdminSpotType } from '@/api/schemas'

/**
 * Deutsche Labels der Startplatz-Typen (Wire-Keys bleiben englisch). Eigene Datei, weil Tabelle,
 * Filterleiste und Formular sie brauchen — und ein Konstanten-Export aus einer Komponenten-Datei
 * Fast-Refresh aushebelt.
 */
export const SPOT_TYPE_LABEL: Record<AdminSpotType, string> = {
  launch: 'Startplatz',
  landing: 'Landeplatz',
  area: 'Gebiet',
}
