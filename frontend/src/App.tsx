import { useState, type ReactNode } from 'react'

/** Wing-Icon: Gleitschirm-Canopy + Coral-Sonne, auf Sky-Verlauf-Quadrat */
function Logo({ size = 36 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="grid place-items-center rounded-[11px]"
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(150deg,#5BB8F5,#1E90E6 55%,#0F6FBE)',
        }}
      >
        <svg width={size * 0.72} height={size * 0.52} viewBox="0 0 64 44" fill="none">
          <circle cx="45" cy="15" r="7.5" fill="#FF6B4A" />
          <path d="M6 25 C 18 9, 46 9, 58 25 C 46 18, 18 18, 6 25 Z" fill="#fff" />
        </svg>
      </span>
      <span className="font-display text-[19px] font-extrabold tracking-tight text-base-content">
        Flight<span className="text-primary">Meet</span>
      </span>
    </span>
  )
}

function Section({
  n,
  title,
  sub,
  children,
}: {
  n: string
  title: string
  sub?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-box border border-base-300 bg-base-100 p-7 shadow-card">
      <div className="mb-5 flex items-baseline gap-3">
        <span className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          {n}
        </span>
        <span className="text-sm text-base-content/50">{title}</span>
        {sub && <span className="ml-auto text-xs text-base-content/40">{sub}</span>}
      </div>
      {children}
    </section>
  )
}

type Tone = { label: string; bg: string; fg: string; dot: string }

const EXPERIENCE: Tone[] = [
  { label: 'Anfänger', bg: '#E4F6EC', fg: '#157A43', dot: '#1E9E5A' },
  { label: 'Fortgeschritten', bg: '#E5F1FD', fg: '#0C5896', dot: '#1E90E6' },
  { label: 'Experte', bg: '#FFE1D8', fg: '#C7421F', dot: '#FF6B4A' },
  { label: 'Alle Level', bg: '#E8F3F4', fg: '#0A4F57', dot: '#117D87' },
]
const STATUS: Tone[] = [
  { label: 'Offen', bg: '#E4F6EC', fg: '#157A43', dot: '#1E9E5A' },
  { label: 'Ausgebucht', bg: '#FBF0D6', fg: '#8A5D00', dot: '#E8A21A' },
  { label: 'Abgesagt', bg: '#FCE6E7', fg: '#B42318', dot: '#E5484D' },
  { label: 'Beendet', bg: '#EEF3F9', fg: '#5B6B7E', dot: '#94A3B5' },
]

function Pill({
  bg,
  fg,
  dot,
  children,
}: {
  bg: string
  fg: string
  dot?: string
  children: ReactNode
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold"
      style={{ background: bg, color: fg }}
    >
      {dot && <span className="size-1.5 rounded-full" style={{ background: dot }} />}
      {children}
    </span>
  )
}

export default function App() {
  const [dark, setDark] = useState(false)
  const setTheme = (d: boolean) => {
    setDark(d)
    document.documentElement.dataset.theme = d ? 'flightmeet-dark' : 'flightmeet'
  }

  return (
    <div className="min-h-svh bg-base-200 text-base-content">
      {/* Top-Bar */}
      <header className="sticky top-0 z-20 border-b border-base-300 bg-base-100/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-3">
          <Logo />
          <nav className="ml-2 hidden items-center gap-1 sm:flex">
            {['Home', 'Flugtreffen', 'Gruppen', 'Chat'].map((x, i) => (
              <span
                key={x}
                className={`rounded-full px-3.5 py-2 text-sm ${
                  i === 1 ? 'bg-sky-50 font-semibold text-sky-700' : 'text-base-content/60'
                }`}
              >
                {x}
              </span>
            ))}
          </nav>
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-base-content/60">
            <span>Light</span>
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={dark}
              onChange={(e) => setTheme(e.target.checked)}
            />
            <span>Dark</span>
          </label>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-8 pb-28">
        <div>
          <div className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
            Design-System · v1.0 · Deutsch
          </div>
          <h1 className="mt-1 text-4xl text-base-content">Gemeinsam abheben.</h1>
          <p className="mt-2 max-w-lg text-base-content/60">
            Styleguide-Vorschau — Tokens, Farben und Komponenten aus dem Claude-Design-Entwurf,
            umgesetzt als DaisyUI-Theme (Light &amp; Dark).
          </p>
        </div>

        {/* Buttons */}
        <Section n="05" title="Buttons" sub="Pille · ≥44px · Zustände">
          <div className="flex flex-wrap items-center gap-3.5">
            <button className="btn btn-primary rounded-full shadow-[0_8px_18px_rgba(30,144,230,.3)]">
              Teilnehmen
            </button>
            <button className="btn btn-accent rounded-full">Treffen erstellen</button>
            <button className="btn btn-outline rounded-full border-[1.5px] border-base-300 text-sky-700">
              Absagen
            </button>
            <button className="btn btn-ghost rounded-full text-sky-700">Mehr anzeigen</button>
            <button className="btn btn-secondary rounded-full">Anfragen</button>
            <button className="btn btn-primary btn-disabled rounded-full">Disabled</button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3.5">
            <button className="btn btn-primary btn-lg rounded-full">Large · 48px</button>
            <button className="btn btn-primary rounded-full">Medium</button>
            <button className="btn btn-primary btn-sm rounded-full">Small</button>
            <button
              className="btn btn-circle btn-ghost border-[1.5px] border-base-300"
              aria-label="Teilen"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F6FBE" strokeWidth="2" strokeLinecap="round">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
              </svg>
            </button>
            <button
              className="btn btn-circle btn-accent size-13 shadow-[0_10px_22px_rgba(241,87,47,.36)]"
              aria-label="Neues Treffen"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </Section>

        {/* Badges */}
        <Section n="06" title="Badges & Chips" sub="farbcodiert & scanbar">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <div className="mb-3 font-display text-sm font-bold">Erfahrungslevel</div>
              <div className="flex flex-wrap gap-2.5">
                {EXPERIENCE.map((e) => (
                  <Pill key={e.label} bg={e.bg} fg={e.fg} dot={e.dot}>
                    {e.label}
                  </Pill>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-3 font-display text-sm font-bold">Treffen-Status</div>
              <div className="flex flex-wrap gap-2.5">
                {STATUS.map((s) => (
                  <Pill key={s.label} bg={s.bg} fg={s.fg} dot={s.dot}>
                    {s.label}
                  </Pill>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-3 font-display text-sm font-bold">Region · Tags</div>
              <div className="flex flex-wrap gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-petrol-100 bg-base-100 px-3 py-1.5 text-[13px] font-medium text-petrol-700">
                  📍 Rhön
                </span>
                <span className="rounded-full bg-base-200 px-3 py-1.5 text-[13px] font-medium text-base-content/80"># XC-Streckenflug</span>
                <span className="rounded-full bg-base-200 px-3 py-1.5 text-[13px] font-medium text-base-content/80"># Hike &amp; Fly</span>
              </div>
            </div>
            <div>
              <div className="mb-3 font-display text-sm font-bold">Zähler &amp; Hervorhebung</div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 font-semibold">
                  Chat
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-coral-500 px-1.5 text-[11px] font-bold text-white">5</span>
                </span>
                <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-content">NEU</span>
                <span className="rounded-full bg-coral-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-coral-700">Ersteller</span>
              </div>
            </div>
          </div>
        </Section>

        {/* Flugtreffen-Card + Chat */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Section n="07" title="Flugtreffen-Card">
            <article className="overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-hover">
              <div className="relative h-38" style={{ background: 'linear-gradient(180deg,#4FA8EE 0%,#86C9F4 48%,#C7E6FA 100%)' }}>
                <div className="absolute inset-0" style={{ background: 'radial-gradient(130px 90px at 82% 18%,rgba(255,193,120,.62),rgba(255,193,120,0) 70%)' }} />
                <svg className="absolute bottom-0 left-0 h-15 w-full" viewBox="0 0 540 60" preserveAspectRatio="none">
                  <path d="M0 38 L90 20 L160 36 L250 12 L340 34 L430 16 L540 32 L540 60 L0 60 Z" fill="#3E7C84" />
                  <path d="M0 50 L120 40 L240 50 L360 38 L470 50 L540 44 L540 60 L0 60 Z" fill="#2A5C63" />
                </svg>
                <span className="absolute right-3 top-3">
                  <Pill bg="rgba(255,255,255,.94)" fg="#157A43" dot="#1E9E5A">Offen</Pill>
                </span>
                <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-[rgba(14,23,38,.5)] px-2.5 py-1 text-xs font-semibold text-white">
                  📍 Tegelberg · 1720&thinsp;m
                </span>
              </div>
              <div className="p-4.5">
                <div className="mb-2 flex gap-2">
                  <Pill bg="#E5F1FD" fg="#0C5896" dot="#1E90E6">Fortgeschritten</Pill>
                  <span className="rounded-full border-[1.5px] border-base-300 px-3 py-1 text-xs font-semibold">Sa 28.6. · 17:00</span>
                </div>
                <h3 className="font-display text-lg text-base-content">Abendthermik am Tegelberg</h3>
                <div className="mb-3.5 mt-1 flex items-center gap-1.5 text-[13px] text-base-content/60">📍 Tegelberg · Allgäu</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-base-content/70">8 von 12 Plätzen</span>
                  <button className="btn btn-primary btn-sm rounded-full">Teilnehmen</button>
                </div>
              </div>
            </article>
          </Section>

          <Section n="09" title="Chat" sub="Ersteller hervorgehoben">
            <div className="flex flex-col gap-3 rounded-[18px] border border-base-300 bg-base-200 p-4">
              {/* incoming */}
              <div className="flex max-w-[85%] gap-2.5">
                <div className="grid size-8.5 shrink-0 place-items-center self-end rounded-full bg-petrol-500 text-xs font-bold text-white">MT</div>
                <div>
                  <div className="mb-0.5 pl-1 text-xs font-semibold text-base-content/60">Markus Thaler</div>
                  <div className="rounded-[18px_18px_18px_6px] border border-base-300 bg-base-100 px-3.5 py-2.5 text-sm">Wetter sieht top aus für morgen früh! ☀️</div>
                </div>
              </div>
              {/* creator highlighted */}
              <div className="flex max-w-[88%] gap-2.5">
                <div
                  className="grid size-8.5 shrink-0 place-items-center self-end rounded-full text-xs font-bold text-white ring-2 ring-coral-500 ring-offset-2 ring-offset-base-200"
                  style={{ background: 'linear-gradient(150deg,#FF8062,#F1572F)' }}
                >
                  LK
                </div>
                <div className="min-w-0">
                  <div className="mb-0.5 flex items-center gap-1.5 pl-1">
                    <span className="text-xs font-semibold text-coral-700">Lena Krüger</span>
                    <span className="rounded-full bg-coral-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-coral-700">Ersteller</span>
                  </div>
                  <div className="rounded-[14px_18px_18px_6px] border border-coral-500/25 border-l-[3px] border-l-coral-500 bg-coral-500/10 px-3.5 py-2.5 text-sm text-base-content">
                    Treffpunkt 9:30 Uhr am oberen Parkplatz. Bitte Schirm-Check machen. 🪂
                  </div>
                  <div className="mt-1.5 flex gap-1.5 pl-1">
                    <span className="rounded-full border border-base-300 bg-base-100 px-2 py-0.5 text-xs font-semibold">👍 4</span>
                    <span className="rounded-full border border-base-300 bg-base-100 px-2 py-0.5 text-xs font-semibold">🪂 2</span>
                  </div>
                </div>
              </div>
              {/* own */}
              <div className="flex justify-end">
                <div className="max-w-[78%]">
                  <div className="rounded-[18px_18px_6px_18px] bg-primary px-3.5 py-2.5 text-sm text-primary-content">Bin dabei! Nehme jemanden vom Parkplatz mit. 🚐</div>
                  <div className="mt-1 text-right text-xs text-base-content/50">9:22 · Gelesen</div>
                </div>
              </div>
              {/* input */}
              <div className="mt-1 flex items-center gap-2.5">
                <div className="flex flex-1 items-center rounded-full border-[1.5px] border-base-300 bg-base-100 px-4 py-2.5 text-sm text-base-content/50">Nachricht an Lena…</div>
                <button className="btn btn-circle btn-primary" aria-label="Senden">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
            </div>
          </Section>
        </div>
      </main>

      {/* Mobile Bottom-Nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-base-300 bg-base-100/95 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-md items-end justify-around px-2 py-2.5">
          {[
            { l: 'Home', a: true, badge: 0 },
            { l: 'Flugtreffen', a: false, badge: 0 },
            { l: 'Gruppen', a: false, badge: 0 },
            { l: 'Chat', a: false, badge: 5 },
          ].map((t) => (
            <div key={t.l} className="relative flex min-w-15 flex-col items-center gap-1">
              <div className={`size-6 rounded-md ${t.a ? 'bg-primary' : 'bg-base-content/25'}`} />
              <span className={`text-[11px] ${t.a ? 'font-semibold text-sky-700' : 'text-base-content/50'}`}>{t.l}</span>
              {t.badge > 0 && (
                <span className="absolute -top-1.5 right-2 grid size-4.5 place-items-center rounded-full bg-coral-500 text-[10px] font-bold text-white">{t.badge}</span>
              )}
            </div>
          ))}
        </div>
      </nav>
    </div>
  )
}
