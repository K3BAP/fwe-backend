import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useAdminAuth } from '../../store/adminAuth'
import { api } from '../../api/client'
import { ThemeToggle } from '../../components/ui'
import { pageVariants } from '../../lib/motion'

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
      <header className="sticky top-0 z-10 border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-8 w-8" />
            <span className="font-bold text-fg">City-Rallye Admin</span>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <Item to="/admin" label="Rallyes" />
            <Item to="/admin/scan" label="Scanner" />
            <Item to="/admin/admins" label="Admins" />
            <ThemeToggle className="text-muted" />
            <button onClick={logout} className="rounded-lg px-3 py-2 font-medium text-muted transition-colors hover:bg-surface-2">
              Abmelden ({auth.admin?.username})
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname} variants={pageVariants} initial="hidden" animate="show" exit="exit">
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

function Item({ to, label }: { to: string; label: string }) {
  return (
    <NavLink to={to} end={to === '/admin'} className="relative rounded-lg px-3 py-2 font-medium">
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="admin-nav-pill"
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
