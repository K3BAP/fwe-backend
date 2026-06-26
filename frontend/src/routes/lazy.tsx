import { lazy, Suspense, type ReactNode } from 'react'
import { Spinner } from '@/components/ui'

/** Suspense-Hülle mit zentriertem Spinner für code-gesplittete Routen. */
export function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="grid place-items-center py-20"><Spinner size="lg" /></div>}>
      {children}
    </Suspense>
  )
}

/** Styleguide zieht Leaflet/Map — lazy, damit es nicht im Initial-Bundle landet. */
export const StyleguideLazy = lazy(() => import('./Styleguide').then((m) => ({ default: m.Styleguide })))

/** Flugtreffen-Übersicht + Detail nutzen Leaflet — lazy, damit das Dashboard schlank lädt. */
export const FlugtreffenLazy = lazy(() => import('./Flugtreffen').then((m) => ({ default: m.Flugtreffen })))
export const MeetupDetailLazy = lazy(() => import('./MeetupDetail').then((m) => ({ default: m.MeetupDetail })))
