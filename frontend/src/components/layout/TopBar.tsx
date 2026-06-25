import { Link, NavLink } from 'react-router-dom'
import { Avatar, Logo } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/stores/authStore'
import { BellIcon, SearchIcon } from './icons'
import { NAV } from './nav'
import { ThemeToggle } from './ThemeToggle'

/** Desktop-Top-Bar mit Logo, Navigation, Suche/Glocke, Theme-Toggle, Avatar. */
export function TopBar() {
  const user = useAuthStore((s) => s.user)
  return (
    <header className="sticky top-0 z-30 border-b border-base-300 bg-base-100/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 sm:px-5 sm:py-3">
        <Link to="/" aria-label="FlightMeet — Startseite">
          <Logo />
        </Link>
        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm',
                  isActive ? 'bg-sky-50 font-semibold text-sky-700' : 'text-base-content/60 hover:bg-base-200',
                )
              }
            >
              {item.label}
              {item.badge ? (
                <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-coral-500 px-1 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className="btn btn-circle btn-ghost btn-sm" aria-label="Suchen">
            <SearchIcon size={18} />
          </button>
          <button type="button" className="btn btn-circle btn-ghost btn-sm" aria-label="Benachrichtigungen">
            <BellIcon size={18} />
          </button>
          <ThemeToggle />
          <Link to="/einstellungen" aria-label="Konto & Einstellungen">
            <Avatar name={user?.displayName ?? 'Gast'} src={user?.avatarUrl} size={34} />
          </Link>
        </div>
      </div>
    </header>
  )
}
