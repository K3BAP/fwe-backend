import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useMe } from '../../api/participant'
import { useSession } from '../../store/session'
import { Centered, Spinner } from '../../components/ui'

export default function ParticipantLayout() {
  const { data, isLoading, isError } = useMe()
  const session = useSession()
  const navigate = useNavigate()
  const location = useLocation()

  // Ungültige Sitzung -> abmelden.
  useEffect(() => {
    if (isError) {
      session.leave()
      navigate('/', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError])

  // Team-Pflicht: Teams aktiv & noch kein Team -> Team-Auswahl erzwingen.
  const needsTeam = data?.rallye.teams_enabled && !data.team
  const onTeamPage = location.pathname === '/rallye/team'
  useEffect(() => {
    if (needsTeam && !onTeamPage) navigate('/rallye/team', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsTeam, onTeamPage])

  if (isLoading || !data)
    return (
      <Centered>
        <Spinner />
      </Centered>
    )

  const leave = () => {
    if (confirm('Möchtest du die Rallye wirklich verlassen? Deine Sitzung geht verloren.')) {
      session.leave()
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col">
      <header className="safe-top sticky top-0 z-10 flex items-center justify-between gap-3 bg-indigo-600 px-4 py-3 text-white shadow">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{data.rallye.title}</p>
          <p className="truncate text-xs text-indigo-200">
            {data.team ? data.team.name : data.participant.display_name}
          </p>
        </div>
        <button onClick={leave} className="shrink-0 rounded-lg px-2 py-1 text-sm text-indigo-100 hover:bg-indigo-500">
          Verlassen
        </button>
      </header>

      <main className="flex-1 p-4 pb-24">
        <Outlet />
      </main>

      {!needsTeam && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-xl border-t border-slate-200 bg-white">
          <Tab to="/rallye" label="Stationen" />
          <Tab to="/rallye/leaderboard" label="Rangliste" />
        </nav>
      )}
    </div>
  )
}

function Tab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `flex-1 py-3 text-center text-sm font-medium ${isActive ? 'text-indigo-600' : 'text-slate-500'}`
      }
    >
      {label}
    </NavLink>
  )
}
