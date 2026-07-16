import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { useGroups } from '@/api/groups'
import { useSpots } from '@/api/spots'
import type { GroupListItem } from '@/api/schemas'
import { JoinPolicyBadge, VisibilityBadge } from '@/components/groups/GroupBadges'
import { ChatIcon, ChevronRightIcon, MapPinIcon, UsersIcon, WingIcon } from '@/components/layout/icons'
import { Logo, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'

/**
 * Gast-Landing (Marketing, ohne App-Chrome): Sticky-Nav, Hero, Feature-Werbung, **echte öffentliche
 * Gruppen** + beliebte Spots (beide aus dem öffentlichen Backend gezogen), Abschluss-CTA, Footer.
 * Theme-adaptiv (DaisyUI-Tokens); der Himmel-Hero bleibt feste Markenfarbe. Entwurf: `spec/design`
 * (Landing-Draft). Bewegung respektiert `prefers-reduced-motion` via {@link Reveal}.
 */
export function Landing() {
  return (
    <div className="min-h-svh bg-base-100 text-base-content">
      <LandingNav />
      <Hero />
      <Features />
      <PublicGroups />
      <PopularSpots />
      <CtaBand />
      <LandingFooter />
    </div>
  )
}

/** Sanftes Einblenden beim Scrollen (einmalig); ohne Bewegung bei `prefers-reduced-motion`. */
function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay }}
    >
      {children}
    </motion.div>
  )
}

const NAV_LINKS = [
  { id: 'features', label: 'Funktionen' },
  { id: 'gruppen', label: 'Gruppen' },
  { id: 'spots', label: 'Spots' },
]

/**
 * Sticky-Nav für die Landing: liegt zuoberst (fixed) und ist über dem Himmel-Hero **transparent**
 * (weiße Schrift); sobald gescrollt wird, blendet sie weich in eine feste Leiste (base-100 + Blur,
 * dunkle Schrift) — sonst wäre die weiße Schrift über den hellen Sektionen unlesbar. Anker-Links
 * scrollen sanft zur Sektion (respektiert `prefers-reduced-motion`).
 */
function LandingNav() {
  const reduce = useReducedMotion()
  const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > 24)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300',
        scrolled ? 'border-base-300 bg-base-100/85 backdrop-blur' : 'border-transparent',
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-5 py-4 sm:px-8">
        <Logo onDark={!scrolled} />
        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => scrollTo(e, id)}
              className={cn(
                'rounded-full px-3 py-2 text-sm font-medium transition-colors',
                scrolled ? 'text-base-content/60 hover:bg-base-200 hover:text-base-content' : 'text-white/80 hover:bg-white/10 hover:text-white',
              )}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/login" className={cn('btn btn-ghost rounded-full text-sm', !scrolled && 'text-white hover:bg-white/10')}>
            Anmelden
          </Link>
          <Link
            to="/register"
            className={cn('btn rounded-full border-0 text-sm shadow-card', scrolled ? 'btn-primary' : 'bg-white text-sky-700 hover:bg-white/90')}
          >
            Registrieren
          </Link>
        </div>
      </div>
    </header>
  )
}

/**
 * Vollflächiger Himmel-Hero (immersiv): Verlauf + Sonne + Gleitschirm + Bergkamm als feste Markenoptik,
 * Copy in Weiß. Die Nav liegt als {@link LandingNav} darüber (fixed/sticky), daher hier kein Header.
 */
function Hero() {
  const reduce = useReducedMotion()
  return (
    <section className="relative isolate flex min-h-svh flex-col overflow-hidden text-white">
      {/* Himmel-Ebenen */}
      <div className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(162deg,#0C5896 0%,#1E90E6 42%,#4FA8EE 100%)' }} />
      <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(460px 320px at 80% 6%,rgba(255,176,120,.82),rgba(255,176,120,0) 68%)' }} />
      <svg className="absolute left-[60%] top-[24%] -z-10 h-14 w-24 opacity-90 sm:left-[64%]" viewBox="0 0 64 44" fill="none" aria-hidden>
        <path d="M6 22 C 18 8, 46 8, 58 22 C 46 16, 18 16, 6 22 Z" fill="rgba(14,23,38,.55)" />
        <path d="M20 19 L30 31 M44 19 L34 31" stroke="rgba(14,23,38,.5)" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <svg className="absolute inset-x-0 bottom-0 -z-10 h-40 w-full sm:h-52" viewBox="0 0 1440 180" preserveAspectRatio="none" aria-hidden>
        <path d="M0 110 L220 60 L420 104 L660 40 L900 96 L1140 52 L1440 92 L1440 180 L0 180 Z" fill="#1B6E78" opacity="0.85" />
        <path d="M0 140 L300 116 L620 142 L940 112 L1200 142 L1440 126 L1440 180 L0 180 Z" fill="#0A4F57" />
      </svg>

      {/* Copy */}
      <motion.div
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pb-36 pt-24 sm:px-8"
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur">
          <span className="size-1.5 rounded-full bg-success" />
          2.400+ Pilot:innen fliegen schon mit
        </span>
        <h1 className="mt-5 max-w-3xl font-display text-5xl font-extrabold leading-[1.03] tracking-tight drop-shadow-sm sm:text-6xl lg:text-7xl">
          Finde deine nächste Thermik – gemeinsam fliegen.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/90">
          FlightMeet bringt Gleitschirmflieger zusammen: Finde Flugtreffen an deinem Lieblings-Startplatz,
          organisiere dich in Gruppen und bleib per Chat in Kontakt.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to="/register" className="btn rounded-full border-0 bg-white px-7 text-sky-700 shadow-hover hover:bg-white/90">
            Kostenlos registrieren
          </Link>
          <Link to="/login" className="btn btn-ghost rounded-full border border-white/40 px-6 text-white hover:bg-white/10">
            Anmelden
          </Link>
        </div>
        <div className="mt-8 flex items-center gap-3">
          <div className="flex">
            {[
              { i: 'LK', c: 'bg-coral-500' },
              { i: 'MT', c: 'bg-sky-500' },
              { i: 'SB', c: 'bg-petrol-500' },
            ].map((a, idx) => (
              <span
                key={a.i}
                className={`grid size-9 place-items-center rounded-full border-2 border-white/80 text-xs font-bold text-white ${a.c} ${idx > 0 ? '-ml-2.5' : ''}`}
              >
                {a.i}
              </span>
            ))}
          </div>
          <span className="text-sm text-white/85">Aktive Communities in Rhön, Allgäu, Mosel &amp; Eifel</span>
        </div>
      </motion.div>
    </section>
  )
}

const FEATURES = [
  { icon: <MapPinIcon size={24} />, tint: 'bg-sky-100 text-sky-700', title: 'Treffen finden', desc: 'Flugtreffen an deinem Startplatz – als Cards, auf der Karte oder als Tabelle.' },
  { icon: <UsersIcon size={24} />, tint: 'bg-coral-100 text-coral-700', title: 'Gruppen', desc: 'Organisiere dich in Communities mit Feed, Channels und Mitgliedern.' },
  { icon: <ChatIcon size={24} />, tint: 'bg-petrol-100 text-petrol-700', title: 'Chat', desc: 'Bleib in Kontakt – Channels, Treffen-Chats und Direktnachrichten.' },
  { icon: <WingIcon size={24} />, tint: 'bg-base-200 text-base-content/70', title: 'Profil', desc: 'Zeig dein Erfahrungslevel, deinen Schirm und deine Heimat-Region.' },
]

function Features() {
  return (
    <section id="features" className="scroll-mt-20 bg-base-200/60 py-16">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="mb-10 text-center">
          <div className="mb-2 font-display text-xs font-bold uppercase tracking-[0.08em] text-primary">Alles an einem Ort</div>
          <h2 className="font-display text-3xl font-bold tracking-tight">Alles für den gemeinsamen Flugtag</h2>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.06}>
              <div className="h-full rounded-3xl border border-base-300 bg-base-100 p-6 shadow-card">
                <div className={`mb-4 grid size-12 place-items-center rounded-2xl ${f.tint}`}>{f.icon}</div>
                <div className="mb-1.5 font-display text-lg font-bold">{f.title}</div>
                <p className="text-sm leading-relaxed text-base-content/60">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

const GROUP_COLORS = ['#1E90E6', '#FF6B4A', '#117D87', '#5B79C7', '#1E9E5A', '#E8A21A']

/** Initialen aus dem Gruppennamen (erste Buchstaben der ersten beiden Wörter). */
function groupInitials(name: string): string {
  const words = name.replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/)
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase()
}

function PublicGroups() {
  const { data, isLoading, isError } = useGroups()
  const groups = (data ?? []).slice(0, 6)

  return (
    <section id="gruppen" className="scroll-mt-20 bg-base-100 py-16">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="mb-2 font-display text-xs font-bold uppercase tracking-[0.08em] text-primary">Communities</div>
            <h2 className="font-display text-3xl font-bold tracking-tight">Öffentliche Gruppen</h2>
            <p className="mt-2 max-w-lg text-base-content/60">Tritt einer Community in deiner Region bei – vom Anfängertreff bis zur Streckenflug-Runde.</p>
          </div>
          <Link to="/register" className="text-sm font-semibold text-primary hover:underline">
            Alle Gruppen entdecken →
          </Link>
        </Reveal>

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-40 rounded-3xl" />)}
          </div>
        )}

        {!isLoading && groups.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g, i) => (
              <Reveal key={g.id} delay={(i % 3) * 0.06}>
                <GroupTeaser group={g} color={GROUP_COLORS[i % GROUP_COLORS.length]} />
              </Reveal>
            ))}
          </div>
        )}

        {!isLoading && groups.length === 0 && (
          <div className="rounded-3xl border border-base-300 bg-base-200/50 p-8 text-center text-base-content/60">
            {isError ? 'Gruppen konnten gerade nicht geladen werden.' : 'Bald gibt es hier öffentliche Gruppen.'}
          </div>
        )}
      </div>
    </section>
  )
}

function GroupTeaser({ group, color }: { group: GroupListItem; color: string }) {
  return (
    <Link
      to="/register"
      className="flex h-full flex-col rounded-3xl border border-base-300 bg-base-100 p-5 shadow-card transition hover:border-primary/40 hover:shadow-hover"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl font-display text-lg font-bold text-white" style={{ background: color }}>
          {groupInitials(group.name)}
        </span>
        <div className="min-w-0">
          <div className="truncate font-display text-lg font-bold leading-tight">{group.name}</div>
          {group.region && (
            <div className="flex items-center gap-1 text-sm text-base-content/55">
              <MapPinIcon size={14} />
              {group.region}
            </div>
          )}
        </div>
      </div>
      {group.description && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-base-content/60">{group.description}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <VisibilityBadge visibility={group.visibility} />
        <JoinPolicyBadge policy={group.join_policy} />
        <span className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-base-content/60">
          <UsersIcon size={15} />
          {group.members_count}
        </span>
      </div>
    </Link>
  )
}

const SPOT_GRADIENTS = [
  'linear-gradient(180deg,#4FA8EE,#86C9F4 60%,#C7E6FA)',
  'linear-gradient(180deg,#4A93D6,#E59E5A)',
  'linear-gradient(180deg,#84B6E4,#C3DCEE 60%,#EBDCC6)',
  'linear-gradient(180deg,#2F5C9E,#7A6FB2 55%,#FF9277)',
]

function PopularSpots() {
  const { data, isLoading } = useSpots()
  const spots = (data ?? []).slice(0, 8)

  return (
    <section id="spots" className="scroll-mt-20 bg-base-200/60 py-16">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="mb-8 flex items-end justify-between gap-2">
          <h2 className="font-display text-3xl font-bold tracking-tight">Beliebte Spots</h2>
          <Link to="/register" className="text-sm font-semibold text-primary hover:underline">
            Alle Spots →
          </Link>
        </Reveal>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {spots.map((s, i) => (
              <Reveal key={s.id} delay={(i % 4) * 0.05}>
                <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100">
                  <div className="relative h-24" style={{ background: SPOT_GRADIENTS[i % SPOT_GRADIENTS.length] }}>
                    <svg className="absolute bottom-0 h-9 w-full" viewBox="0 0 200 34" preserveAspectRatio="none" aria-hidden>
                      <path d="M0 22 L50 10 L100 20 L150 8 L200 18 L200 34 L0 34 Z" fill="#2A5C63" />
                    </svg>
                  </div>
                  <div className="px-3.5 py-3">
                    <div className="truncate font-display text-sm font-bold">{s.name}</div>
                    <div className="truncate text-xs text-base-content/55">{s.region}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function CtaBand() {
  return (
    <section className="bg-base-100 py-16">
      <Reveal className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="relative overflow-hidden rounded-[32px] px-8 py-14 text-center text-white shadow-popover" style={{ background: 'linear-gradient(150deg,#0C5896 0%,#1E90E6 55%,#4FA8EE 100%)' }}>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(360px 200px at 80% 10%,rgba(255,176,120,.55),rgba(255,176,120,0) 70%)' }} />
          <div className="relative">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Bereit abzuheben?</h2>
            <p className="mx-auto mt-3 max-w-md text-white/85">Erstelle in einer Minute dein Profil und finde deinen nächsten gemeinsamen Flugtag.</p>
            <Link to="/register" className="btn mt-7 rounded-full border-0 bg-white px-8 text-sky-700 shadow-card hover:bg-white/90">
              Kostenlos registrieren
              <ChevronRightIcon size={18} />
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function LandingFooter() {
  return (
    <footer className="bg-neutral text-neutral-content">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-7 sm:flex-row sm:px-8">
        <Logo onDark />
        <span className="text-sm text-neutral-content/55 sm:ml-auto">© 2026 FlightMeet · Datenschutz · Impressum · Sicher fliegen</span>
      </div>
    </footer>
  )
}
