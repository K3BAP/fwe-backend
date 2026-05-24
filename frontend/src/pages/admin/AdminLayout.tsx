import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../../store/adminAuth'
import { api } from '../../api/client'

export default function AdminLayout() {
  const auth = useAdminAuth()
  const navigate = useNavigate()

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
    <div className="min-h-full bg-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-8 w-8" />
            <span className="font-bold text-slate-900">City-Rallye Admin</span>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <Item to="/admin" label="Rallyes" />
            <Item to="/admin/scan" label="Scanner" />
            <Item to="/admin/admins" label="Admins" />
            <button onClick={logout} className="rounded-lg px-3 py-2 font-medium text-slate-500 hover:bg-slate-100">
              Abmelden ({auth.admin?.username})
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">
        <Outlet />
      </main>
    </div>
  )
}

function Item({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/admin'}
      className={({ isActive }) =>
        `rounded-lg px-3 py-2 font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`
      }
    >
      {label}
    </NavLink>
  )
}
