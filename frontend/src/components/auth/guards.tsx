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
