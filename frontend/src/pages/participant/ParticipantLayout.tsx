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
        className="safe-top sticky top-0 z-10 border-b border-white/10 bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lift"
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <img
            src={`${import.meta.env.BASE_URL}icon.svg`}
            alt=""
            className="h-9 w-9 shrink-0 rounded-xl bg-white/15 p-1.5 shadow-sm ring-1 ring-white/20"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight">{data.rallye.title}</p>
            <span className="mt-0.5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium ring-1 ring-white/15">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/70" />
              <span className="truncate">{data.team ? data.team.name : data.participant.display_name}</span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle className="text-white" />
            <button
              onClick={leave}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              <span>Verlassen</span>
            </button>
          </div>
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
