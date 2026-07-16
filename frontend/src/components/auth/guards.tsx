import { Navigate, Outlet } from 'react-router-dom'
import { DelayedSpinner } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'

/** Vollbild-Ladezustand, solange die Session (`['me']`) noch unbekannt ist (verzögert eingeblendet). */
function RouteFallback() {
  return <DelayedSpinner className="min-h-svh bg-base-200" />
}

/** Schützt App-Routen: Gäste → Landing; bis die Session geladen ist → Spinner. */
export function RequireAuth() {
  const status = useAuthStore((s) => s.status)
  if (status === 'unknown') return <RouteFallback />
  if (status === 'guest') return <Navigate to="/landing" replace />
  return <Outlet />
}

/** Kehrt die Logik um: eingeloggte Nutzer auf Auth-Seiten → zurück ins Dashboard. */
export function RequireGuest() {
  const status = useAuthStore((s) => s.status)
  if (status === 'unknown') return <RouteFallback />
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}

/**
 * Schützt den Admin-Bereich (ADR-019). Die Reihenfolge ist nicht beliebig: erst `unknown`, sonst
 * flöge bei jedem Hard-Reload der Admin raus, weil `/auth/me` noch nicht geantwortet hat und
 * `isAdmin` deshalb kurzzeitig `false` ist.
 *
 * Reine UX-Hürde — durchgesetzt wird der Zugriff serverseitig vom `admin`-Filter. Nicht-Admins landen
 * auf `/` statt auf einem „Kein Zugriff": von `/admin` müssen sie gar nicht erst wissen.
 */
export function RequireAdmin() {
  // Zwei Selektoren statt eines Objekts — ein Objekt-Selektor würde bei jedem Store-Write neu rendern.
  const status = useAuthStore((s) => s.status)
  const isAdmin = useAuthStore((s) => s.user?.isAdmin ?? false)
  if (status === 'unknown') return <RouteFallback />
  if (status === 'guest') return <Navigate to="/landing" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return <Outlet />
}
