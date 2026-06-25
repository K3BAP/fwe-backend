import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { NAV } from './nav'

/** Mobile Bottom-Navigation (Home · Flugtreffen · Gruppen · Chat). */
export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-base-300 bg-base-100/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
        {NAV.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'relative flex min-w-15 flex-col items-center gap-1 rounded-xl px-2 py-1.5',
                isActive ? 'text-sky-700' : 'text-base-content/50',
              )
            }
          >
            <Icon size={24} />
            <span className="text-[11px] font-medium">{label}</span>
            {badge ? (
              <span className="absolute right-2.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-coral-500 px-1 text-[10px] font-bold text-white">
                {badge}
              </span>
            ) : null}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
