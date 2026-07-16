import { lazy, Suspense, type ReactNode } from 'react'
import { DelayedSpinner } from '@/components/ui'

/** Suspense-Hülle mit verzögert einblendendem Spinner für code-gesplittete Routen (kein Aufblitzen). */
export function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<DelayedSpinner className="py-20" />}>{children}</Suspense>
}

/** Styleguide zieht Leaflet/Map — lazy, damit es nicht im Initial-Bundle landet. */
export const StyleguideLazy = lazy(() => import('./Styleguide').then((m) => ({ default: m.Styleguide })))

/** Flugtreffen-Übersicht + Detail nutzen Leaflet — lazy, damit das Dashboard schlank lädt. */
export const FlugtreffenLazy = lazy(() => import('./Flugtreffen').then((m) => ({ default: m.Flugtreffen })))
export const MeetupDetailLazy = lazy(() => import('./MeetupDetail').then((m) => ({ default: m.MeetupDetail })))

/** Admin-Bereich (ADR-019): für alle außer Admins toter Code — eigener Chunk statt Initial-Bundle. */
export const AdminLayoutLazy = lazy(() => import('./admin/AdminLayout').then((m) => ({ default: m.AdminLayout })))
export const AdminOverviewLazy = lazy(() => import('./admin/AdminOverview').then((m) => ({ default: m.AdminOverview })))
export const AdminBenutzerLazy = lazy(() => import('./admin/AdminBenutzer').then((m) => ({ default: m.AdminBenutzer })))
export const AdminFlugtreffenLazy = lazy(() => import('./admin/AdminFlugtreffen').then((m) => ({ default: m.AdminFlugtreffen })))
export const AdminGruppenLazy = lazy(() => import('./admin/AdminGruppen').then((m) => ({ default: m.AdminGruppen })))
export const AdminSpotsLazy = lazy(() => import('./admin/AdminSpots').then((m) => ({ default: m.AdminSpots })))
