import { Link, NavLink } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { useChatUnread } from '@/api/chat'
import { useNotificationUnread } from '@/api/notifications'
import { Avatar, Logo, Pill } from '@/components/ui'
import { ANY_MOCK } from '@/config'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/stores/authStore'
import { BellIcon, SearchIcon } from './icons'
import { NAV } from './nav'
import { ThemeToggle } from './ThemeToggle'

/** Desktop-Top-Bar mit Logo, Navigation, Suche/Glocke, Theme-Toggle, Avatar. */
export function TopBar() {
  const user = useAuthStore((s) => s.user)
  const chatUnread = useChatUnread().data ?? 0
  const notifUnread = useNotificationUnread().data ?? 0
  const reduce = useReducedMotion()
  // Badge poppt beim Hochzählen (Key = Wert ⇒ Remount ⇒ erneute Scale-Animation).
  const pop = reduce ? false : { scale: 0.5 }

  return (
    <header className="sticky top-0 z-30 border-b border-base-300 bg-base-100/90 backdrop-blur">
      <div className="flex w-full items-center gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
        <Link to="/" aria-label="FlightMeet — Startseite">
          <Logo />
        </Link>
        {/* Demo-Hinweis: solange irgendeine Domäne noch Mock-Daten liefert (ADR-016). Fällt mit der letzten. */}
        {ANY_MOCK && (
          <Pill tone="warning" dot className="px-2.5 py-1 text-[11px] uppercase tracking-wide">
            Mock-Daten
          </Pill>
        )}
        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const badge = item.to === '/chat' ? chatUnread : 0
            return (
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
                {badge > 0 && (
                  <motion.span
                    key={badge}
                    initial={pop}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 600, damping: 18 }}
                    className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-coral-500 px-1 text-[10px] font-bold text-white"
                  >
                    {badge}
                  </motion.span>
                )}
              </NavLink>
            )
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className="btn btn-circle btn-ghost btn-sm" aria-label="Suchen">
            <SearchIcon size={18} />
          </button>
          <Link to="/benachrichtigungen" className="relative btn btn-circle btn-ghost btn-sm" aria-label="Benachrichtigungen">
            <BellIcon size={18} />
            {notifUnread > 0 && (
              <motion.span
                key={notifUnread}
                initial={pop}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 600, damping: 18 }}
                className="absolute right-1 top-1 grid h-[16px] min-w-[16px] place-items-center rounded-full bg-coral-500 px-1 text-[9px] font-bold text-white"
              >
                {notifUnread}
              </motion.span>
            )}
          </Link>
          <ThemeToggle />
          <Link to={`/profil/${user?.id ?? 1}`} aria-label="Mein Profil">
            <Avatar name={user?.displayName ?? 'Gast'} src={user?.avatarUrl} size={34} />
          </Link>
        </div>
      </div>
    </header>
  )
}
