import type { ComponentType, SVGProps } from 'react'
import {
  CloudIcon,
  CloudRainIcon,
  FogIcon,
  SnowIcon,
  SunIcon,
  ThunderIcon,
} from '@/components/layout/icons'

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

/**
 * WMO-Wettercodes (Open-Meteo) → deutsche Wetterlage + Icon. Die ~30 Codes werden auf acht Lagen
 * verdichtet: feinere Abstufungen („mäßiger Niesel") tragen für die Flugplanung nichts bei.
 */
export function weatherCodeInfo(code: number): { label: string; Icon: IconComponent } {
  if (code === 0) return { label: 'Klar', Icon: SunIcon }
  if (code <= 2) return { label: 'Leicht bewölkt', Icon: CloudIcon }
  if (code === 3) return { label: 'Bedeckt', Icon: CloudIcon }
  if (code <= 48) return { label: 'Nebel', Icon: FogIcon }
  if (code <= 57) return { label: 'Niesel', Icon: CloudRainIcon }
  if (code <= 67) return { label: 'Regen', Icon: CloudRainIcon }
  if (code <= 77) return { label: 'Schnee', Icon: SnowIcon }
  if (code <= 82) return { label: 'Regenschauer', Icon: CloudRainIcon }
  if (code <= 86) return { label: 'Schneeschauer', Icon: SnowIcon }
  if (code <= 99) return { label: 'Gewitter', Icon: ThunderIcon }
  return { label: 'Wechselhaft', Icon: CloudIcon }
}

/**
 * Farbliche Betonung der Windwerte (DaisyUI-Tokens, damit Dark Mode trägt). Bewusst nur eine
 * **Hervorhebung der Zahl**, keine Flugempfehlung — die Einschätzung bleibt beim Piloten.
 */
export function windTone(kmh: number, kind: 'wind' | 'gusts' = 'wind'): string {
  const [calm, brisk] = kind === 'gusts' ? [25, 35] : [20, 30]
  if (kmh < calm) return 'text-success'
  if (kmh <= brisk) return 'text-warning'
  return 'text-error'
}
