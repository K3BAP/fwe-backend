import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useAdminAuth } from '../../store/adminAuth'
import { api } from '../../api/client'
import { ThemeToggle } from '../../components/ui'
import { pageVariants } from '../../lib/motion'

const NAV = [
  { to: '/admin', label: 'Rallyes' },
  { to: '/admin/scan', label: 'Scanner' },
  { to: '/admin/admins', label: 'Admins' },
]

export default function AdminLayout() {
  const auth = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const logout = async () => {
    try {
      await api('/admin/logout', { method: 'POST', token: auth.token })
    } catch {
      /* Token wird ohnehin verworfen */
    }
    auth.logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-full bg-bg">
      <header className="safe-top sticky top-0 z-10 border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-8 w-8 shrink-0" />
            <span className="truncate font-bold text-fg">City-Rallye Admin</span>
          </div>

          {/* Inline-Navigation ab Tablet-Breite. */}
          <nav className="ml-2 hidden items-center gap-1 text-sm sm:flex">
            {NAV.map((n) => (
              <TopItem key={n.to} to={n.to} label={n.label} />
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <ThemeToggle className="text-muted" />
            <button
              onClick={logout}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2"
            >
              Abmelden<span className="hidden sm:inline"> ({auth.admin?.username})</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 pb-24 sm:pb-4">
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname} variants={pageVariants} initial="hidden" animate="show" exit="exit">
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Tab-Leiste am unteren Rand auf Mobilgeräten. */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-surface sm:hidden">
        {NAV.map((n) => (
          <BottomItem key={n.to} to={n.to} label={n.label} />
        ))}
      </nav>
    </div>
  )
}

function TopItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink to={to} end={to === '/admin'} className="relative rounded-lg px-3 py-2 font-medium">
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="admin-nav-pill-top"
              className="absolute inset-0 rounded-lg bg-brand-50 dark:bg-brand-950"
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            />
          )}
          <span className={`relative ${isActive ? 'text-brand-700 dark:text-brand-300' : 'text-muted'}`}>{label}</span>
        </>
      )}
    </NavLink>
  )
}

function BottomItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink to={to} end={to === '/admin'} className="relative flex-1 py-3 text-center text-sm font-medium">
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="admin-nav-pill-bottom"
              className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-brand-600"
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            />
          )}
          <span className={`transition-colors ${isActive ? 'text-brand-600 dark:text-brand-300' : 'text-muted'}`}>
            {label}
          </span>
        </>
      )}
    </NavLink>
  )
}
