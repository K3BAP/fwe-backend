import { NavLink, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { useChatUnread } from '@/api/chat'
import { cn } from '@/lib/cn'
import { spring } from '@/lib/motion'
import { NAV } from './nav'

/** Mobile Bottom-Navigation (Home · Flugtreffen · Gruppen · Chat). */
export function BottomNav() {
  const chatUnread = useChatUnread().data ?? 0
  const reduce = useReducedMotion()
  // Im Chat-Thread (mobil Vollbild mit eigenem Zurück) stört die Bottom-Nav den Composer → ausblenden.
  if (useLocation().pathname.startsWith('/chat/')) return null
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-base-300 bg-base-100/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
        {NAV.map(({ to, label, icon: Icon, end }) => {
          const badge = to === '/chat' ? chatUnread : 0
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'relative flex min-w-15 flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition-colors duration-200',
                  isActive ? 'text-primary' : 'text-base-content/50',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    // Aktiv-Indikator wandert via layoutId weich zwischen den Tabs.
                    <motion.span
                      layoutId="bottomnav-active"
                      className="absolute inset-0 rounded-xl bg-primary/10"
                      transition={reduce ? { duration: 0 } : spring.gentle}
                    />
                  )}
                  <Icon size={24} />
                  <span className="text-[11px] font-medium">{label}</span>
                  {badge ? (
                    <motion.span
                      key={badge}
                      initial={reduce ? false : { scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={spring.badge}
                      className="absolute right-2.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-coral-500 px-1 text-[10px] font-bold text-white"
                    >
                      {badge}
                    </motion.span>
                  ) : null}
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
