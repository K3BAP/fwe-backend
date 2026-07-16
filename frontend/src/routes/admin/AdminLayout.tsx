import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/cn'

type AdminNavItem = { to: string; label: string; end?: boolean }

/** Unter-Navigation des Admin-Bereichs. Labels deutsch, URL-Segmente technisch (= API-Ressource). */
const ADMIN_NAV: AdminNavItem[] = [
  { to: '/admin', label: 'Übersicht', end: true }, // `end`, sonst wäre „Übersicht" auf jeder Unterseite aktiv
  { to: '/admin/benutzer', label: 'Benutzer' },
  { to: '/admin/flugtreffen', label: 'Flugtreffen' },
  { to: '/admin/gruppen', label: 'Gruppen' },
  { to: '/admin/spots', label: 'Startplätze' },
]

/**
 * Rahmen des Admin-Bereichs (ADR-019): Titel + Unter-Navigation + `<Outlet/>`.
 *
 * `max-w-5xl` deckt sich mit dem AppShell-Container — Tabellen scrollen bei Bedarf horizontal in
 * ihrem eigenen Rahmen (`ui/Table`), die Seite selbst nie.
 */
export function AdminLayout() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl">Administration</h1>
        <p className="text-sm text-base-content/60">
          Verwaltung der gesamten Instanz — Konten, Flugtreffen, Gruppen und Startplätze.
        </p>
      </header>

      <nav className="flex flex-wrap items-center gap-1.5" aria-label="Admin-Bereiche">
        {ADMIN_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'rounded-full px-3.5 py-2 text-sm transition-colors duration-200',
                isActive ? 'bg-primary/12 font-semibold text-primary' : 'text-base-content/60 hover:bg-base-200',
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}
