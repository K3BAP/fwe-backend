import { useEffect, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { fadeInUp, staggerContainer, staggerItem, spring } from '../../lib/motion'

type Platform = 'ios' | 'android' | 'desktop'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua) || (/macintosh/.test(ua) && 'ontouchend' in document)) return 'ios'
  if (/android/.test(ua)) return 'android'
  return 'desktop'
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

const STEPS: Record<Platform, { icon: () => ReactElement; text: string }[]> = {
  ios: [
    { icon: ShareIcon, text: 'Tippe auf das Teilen-Symbol in der Safari-Leiste.' },
    { icon: PlusIcon, text: 'Wähle „Zum Home-Bildschirm“.' },
    { icon: DownloadIcon, text: 'Tippe auf „Hinzufügen“ und öffne die Rallye vom Startbildschirm.' },
  ],
  android: [
    { icon: MenuIcon, text: 'Öffne das Browser-Menü (⋮).' },
    { icon: PlusIcon, text: 'Tippe auf „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.' },
    { icon: DownloadIcon, text: 'Bestätige und öffne die Rallye vom Startbildschirm.' },
  ],
  desktop: [
    { icon: DownloadIcon, text: 'Klicke auf das Installieren-Symbol in der Adressleiste.' },
    { icon: PlusIcon, text: 'Oder öffne das Browser-Menü und wähle „City-Rallye installieren“.' },
    { icon: MenuIcon, text: 'Starte die Rallye als eigenes Fenster.' },
  ],
}

export default function InstallScreen() {
  const navigate = useNavigate()
  const [platform] = useState(detectPlatform)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  // Bereits als installierte App geöffnet -> Schritt überspringen.
  useEffect(() => {
    if (isStandalone()) navigate('/rallye', { replace: true })
  }, [navigate])

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => navigate('/rallye', { replace: true })
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [navigate])

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  const skip = () => navigate('/rallye', { replace: true })
  const steps = STEPS[platform]

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="show"
      className="mx-auto flex min-h-full max-w-md flex-col px-6 pb-10 pt-16"
    >
      <header className="safe-top text-center">
        <img
          src={`${import.meta.env.BASE_URL}icon.svg`}
          alt=""
          className="mx-auto h-20 w-20 rounded-2xl shadow-card"
        />
        <p className="mt-6 text-sm font-medium text-brand-600 dark:text-brand-300">City-Rallye</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-fg">App installieren</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
          Füge die Rallye zu deinem Startbildschirm hinzu – du bleibst angemeldet und kommst mit
          einem Tippen zurück in deine Rallye.
        </p>
      </header>

      <main className="mt-10 flex-1">
        <motion.ol variants={staggerContainer} initial="hidden" animate="show" className="space-y-3">
          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <motion.li
                key={i}
                variants={staggerItem}
                className="flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                  <Icon />
                </div>
                <p className="text-[15px] leading-snug text-fg">{step.text}</p>
              </motion.li>
            )
          })}
        </motion.ol>

        {deferred && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            transition={spring}
            onClick={install}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-[15px] font-semibold text-white shadow-sm hover:bg-brand-700 active:bg-brand-800"
          >
            <DownloadIcon />
            Jetzt installieren
          </motion.button>
        )}
      </main>

      <footer className="pt-6 text-center">
        <button
          onClick={skip}
          className="text-sm font-medium text-muted underline-offset-4 hover:underline"
        >
          Im Browser fortfahren
        </button>
      </footer>
    </motion.div>
  )
}

function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4M8 8l4-4 4 4" />
      <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  )
}
