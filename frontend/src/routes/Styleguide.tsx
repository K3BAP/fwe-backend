import type { ReactNode } from 'react'
import {
  Button,
  Card,
  ExperienceBadge,
  MessageBubble,
  Pill,
  StatusBadge,
  TextField,
} from '@/components/ui'
import type { ExperienceLevel, MeetupStatus } from '@/components/ui'

function Section({ n, title, sub, children }: { n: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <Card className="p-6 sm:p-7">
      <div className="mb-5 flex items-baseline gap-3">
        <span className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-primary">{n}</span>
        <span className="text-sm text-base-content/50">{title}</span>
        {sub && <span className="ml-auto text-xs text-base-content/40">{sub}</span>}
      </div>
      {children}
    </Card>
  )
}

const LEVELS: ExperienceLevel[] = ['beginner', 'advanced', 'expert', 'all']
const STATES: MeetupStatus[] = ['open', 'full', 'cancelled', 'finished']

/** Lebende Referenz der Design-System-Komponenten (Light & Dark). */
export function Styleguide() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
          Design-System · v1.0 · Deutsch
        </div>
        <h1 className="mt-1 text-4xl">Komponenten</h1>
        <p className="mt-2 max-w-lg text-base-content/60">
          Wiederverwendbare Bausteine aus <code>src/components/ui</code>, gegen den Claude-Design-Entwurf.
        </p>
      </div>

      <Section n="05" title="Buttons" sub="Pille · ≥44px">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Teilnehmen</Button>
          <Button variant="accent">Treffen erstellen</Button>
          <Button variant="outline">Absagen</Button>
          <Button variant="ghost">Mehr anzeigen</Button>
          <Button variant="secondary">Anfragen</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="lg">Large · 48px</Button>
          <Button size="md">Medium</Button>
          <Button size="sm">Small</Button>
        </div>
      </Section>

      <Section n="05b" title="Eingaben">
        <div className="grid max-w-xl gap-4 sm:grid-cols-2">
          <TextField label="Spot" defaultValue="Tegelberg" />
          <TextField label="Region" placeholder="Region wählen…" />
          <div className="sm:col-span-2">
            <TextField label="Suche" placeholder="Spot oder Region suchen…" />
          </div>
        </div>
      </Section>

      <Section n="06" title="Badges & Chips" sub="farbcodiert">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <div className="mb-3 font-display text-sm font-bold">Erfahrungslevel</div>
            <div className="flex flex-wrap gap-2.5">
              {LEVELS.map((l) => <ExperienceBadge key={l} level={l} />)}
            </div>
          </div>
          <div>
            <div className="mb-3 font-display text-sm font-bold">Treffen-Status</div>
            <div className="flex flex-wrap gap-2.5">
              {STATES.map((s) => <StatusBadge key={s} status={s} />)}
            </div>
          </div>
          <div>
            <div className="mb-3 font-display text-sm font-bold">Region · Tags · Hervorhebung</div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-petrol-100 bg-base-100 px-3 py-1.5 text-[13px] font-medium text-petrol-700">📍 Rhön</span>
              <span className="rounded-full bg-base-200 px-3 py-1.5 text-[13px] font-medium text-base-content/80"># Hike &amp; Fly</span>
              <Pill bg="#FFE1D8" fg="#C7421F">Ersteller</Pill>
            </div>
          </div>
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section n="07" title="Flugtreffen-Card">
          <Card className="overflow-hidden shadow-hover">
            <div className="relative h-38" style={{ background: 'linear-gradient(180deg,#4FA8EE 0%,#86C9F4 48%,#C7E6FA 100%)' }}>
              <div className="absolute inset-0" style={{ background: 'radial-gradient(130px 90px at 82% 18%,rgba(255,193,120,.62),rgba(255,193,120,0) 70%)' }} />
              <svg className="absolute bottom-0 left-0 h-15 w-full" viewBox="0 0 540 60" preserveAspectRatio="none">
                <path d="M0 38 L90 20 L160 36 L250 12 L340 34 L430 16 L540 32 L540 60 L0 60 Z" fill="#3E7C84" />
                <path d="M0 50 L120 40 L240 50 L360 38 L470 50 L540 44 L540 60 L0 60 Z" fill="#2A5C63" />
              </svg>
              <span className="absolute right-3 top-3"><StatusBadge status="open" /></span>
              <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-[rgba(14,23,38,.5)] px-2.5 py-1 text-xs font-semibold text-white">📍 Tegelberg · 1720&thinsp;m</span>
            </div>
            <div className="p-4.5">
              <div className="mb-2 flex gap-2">
                <ExperienceBadge level="advanced" />
                <span className="rounded-full border-[1.5px] border-base-300 px-3 py-1 text-xs font-semibold">Sa 28.6. · 17:00</span>
              </div>
              <h3 className="font-display text-lg">Abendthermik am Tegelberg</h3>
              <div className="mb-3.5 mt-1 text-[13px] text-base-content/60">📍 Tegelberg · Allgäu</div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-base-content/70">8 von 12 Plätzen</span>
                <Button size="sm">Teilnehmen</Button>
              </div>
            </div>
          </Card>
        </Section>

        <Section n="09" title="Chat" sub="Ersteller hervorgehoben">
          <div className="flex flex-col gap-3 rounded-[18px] border border-base-300 bg-base-200 p-4">
            <MessageBubble author="Markus Thaler" time="9:18">Wetter sieht top aus für morgen früh! ☀️</MessageBubble>
            <MessageBubble author="Lena Krüger" creator reactions={[{ emoji: '👍', count: 4 }, { emoji: '🪂', count: 2 }]}>
              Treffpunkt 9:30 Uhr am oberen Parkplatz. Bitte Schirm-Check machen. 🪂
            </MessageBubble>
            <MessageBubble author="Du" own time="9:22 · Gelesen">Bin dabei! Nehme jemanden vom Parkplatz mit. 🚐</MessageBubble>
            <div className="mt-1 flex items-center gap-2.5">
              <div className="flex flex-1 items-center rounded-full border-[1.5px] border-base-300 bg-base-100 px-4 py-2.5 text-sm text-base-content/50">Nachricht an Lena…</div>
              <button type="button" className="btn btn-circle btn-primary" aria-label="Senden">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
