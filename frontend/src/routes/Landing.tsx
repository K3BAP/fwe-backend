import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui'

/** Gast-Landing (ohne App-Chrome): Himmel-Hero + Wertversprechen + Registrieren/Anmelden. */
export function Landing() {
  return (
    <div className="relative min-h-svh overflow-hidden bg-sky-900">
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(162deg,#0C5896 0%,#1E90E6 42%,#4FA8EE 100%)' }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(460px 300px at 80% 8%,rgba(255,176,120,.8),rgba(255,176,120,0) 68%)' }}
      />
      <svg className="absolute inset-x-0 bottom-0 h-44 w-full" viewBox="0 0 1440 180" preserveAspectRatio="none" aria-hidden>
        <path d="M0 110 L220 60 L420 104 L660 40 L900 96 L1140 52 L1440 92 L1440 180 L0 180 Z" fill="#1B6E78" opacity="0.85" />
        <path d="M0 140 L300 116 L620 142 L940 112 L1200 142 L1440 126 L1440 180 L0 180 Z" fill="#0A4F57" />
      </svg>

      <div className="relative mx-auto flex min-h-svh max-w-2xl flex-col px-5 py-7 text-white">
        <header className="flex items-center justify-between">
          <Logo />
          <Link to="/login" className="text-sm font-semibold text-white/90 hover:text-white">
            Anmelden
          </Link>
        </header>

        <div className="flex flex-1 flex-col justify-center py-12">
          <span className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            Die Community für Gleitschirmflieger
          </span>
          <h1 className="mt-3 font-display text-5xl font-extrabold leading-[1.02] tracking-tight drop-shadow-sm sm:text-6xl">
            Gemeinsam
            <br />
            abheben.
          </h1>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-white/90">
            Finde Flugtreffen in deiner Region, schließ dich Gruppen an und bleib mit der Szene im Chat
            verbunden – vom Anfängerhang bis zum Streckenflug.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/register"
              className="btn rounded-full border-0 bg-white px-6 text-sky-700 shadow-card hover:bg-white/90"
            >
              Kostenlos registrieren
            </Link>
            <Link
              to="/login"
              className="btn btn-ghost rounded-full border border-white/40 px-6 text-white hover:bg-white/10"
            >
              Anmelden
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
