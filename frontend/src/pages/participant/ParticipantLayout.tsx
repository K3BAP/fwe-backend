import { useEffect } from 'react'
import { NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useMe } from '../../api/participant'
import { useSession } from '../../store/session'
import { Centered, Spinner, ThemeToggle } from '../../components/ui'
import { pageVariants } from '../../lib/motion'

export default function ParticipantLayout() {
  const { data, isLoading, isError } = useMe()
  const session = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const element = useOutlet()

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
      <motion.header
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="safe-top sticky top-0 z-10 flex items-center justify-between gap-3 bg-brand-600 px-4 py-3 text-white shadow-lift"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{data.rallye.title}</p>
          <p className="truncate text-xs text-brand-200">
            {data.team ? data.team.name : data.participant.display_name}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle className="text-white" />
          <button onClick={leave} className="rounded-lg px-2 py-1 text-sm text-brand-100 transition-colors hover:bg-brand-500">
            Verlassen
          </button>
        </div>
      </motion.header>

      <main className="flex-1 p-4 pb-24">
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname} variants={pageVariants} initial="hidden" animate="show" exit="exit">
            {element}
          </motion.div>
        </AnimatePresence>
      </main>

      {!needsTeam && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-xl border-t border-line bg-surface">
          <Tab to="/rallye" label="Stationen" />
          <Tab to="/rallye/leaderboard" label="Rangliste" />
        </nav>
      )}
    </div>
  )
}

function Tab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink to={to} end className="relative flex-1 py-3 text-center text-sm font-medium">
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="participant-tab-pill"
              className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-brand-600"
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
