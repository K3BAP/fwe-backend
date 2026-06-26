import { useState, type ReactNode } from 'react'
import { Marker, Popup } from 'react-leaflet'
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  ExperienceBadge,
  MessageBubble,
  Modal,
  Pill,
  SegmentedControl,
  SelectField,
  Skeleton,
  Spinner,
  StatusBadge,
  Switch,
  TextareaField,
  TextField,
  UserCard,
  type SegmentOption,
} from '@/components/ui'
import type { ExperienceLevel, MeetupStatus } from '@/components/ui'
import type { PublicUserCard } from '@/api/schemas'
import { MapShell } from '@/components/map/MapShell'
import { pinIcon } from '@/components/map/pin'
import { WingIcon } from '@/components/layout/icons'
import { toast } from '@/stores/toastStore'

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

const VIEW_OPTIONS: SegmentOption<'cards' | 'table' | 'map'>[] = [
  { value: 'cards', label: 'Cards' },
  { value: 'table', label: 'Tabelle' },
  { value: 'map', label: 'Karte' },
]

const DEMO_USERS: PublicUserCard[] = [
  { id: 1, display_name: 'Lena Krüger', handle: 'lenak', avatar_path: null },
  { id: 2, display_name: 'Markus Thaler', handle: 'thaler_fly', avatar_path: null },
  { id: 3, display_name: 'Sophie Berg', handle: null, avatar_path: null },
]

/** Lebende Referenz der Design-System-Komponenten (Light & Dark). */
export function Styleguide() {
  const [view, setView] = useState<'cards' | 'table' | 'map'>('cards')
  const [freeOnly, setFreeOnly] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-primary">
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

      <Section n="05b" title="Eingaben & Form-Controls">
        <div className="grid max-w-xl gap-4 sm:grid-cols-2">
          <TextField label="Spot" defaultValue="Tegelberg" />
          <SelectField label="Erfahrungslevel" defaultValue="advanced">
            <option value="beginner">Anfänger</option>
            <option value="advanced">Fortgeschritten</option>
            <option value="expert">Experte</option>
            <option value="all">Alle Level</option>
          </SelectField>
          <TextField label="Mit Fehler" defaultValue="zu kurz" error="Bitte mind. 3 Zeichen." />
          <div className="flex items-end">
            <Switch checked={freeOnly} onChange={setFreeOnly} label="Nur freie Plätze" />
          </div>
          <div className="sm:col-span-2">
            <TextareaField label="Beschreibung" placeholder="Worum geht es bei dem Treffen?" />
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
              <span className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-secondary/30 bg-base-100 px-3 py-1.5 text-[13px] font-medium text-secondary">📍 Rhön</span>
              <span className="rounded-full bg-base-200 px-3 py-1.5 text-[13px] font-medium text-base-content/80"># Hike &amp; Fly</span>
              <Pill bg="#FFE1D8" fg="#C7421F">Ersteller</Pill>
            </div>
          </div>
        </div>
      </Section>

      <Section n="08" title="Umschalter & Nutzerzeilen">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-3 font-display text-sm font-bold">SegmentedControl</div>
            <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} aria-label="Ansicht" />
            <p className="mt-2 text-sm text-base-content/50">Aktiv: {view}</p>
          </div>
          <div>
            <div className="mb-3 font-display text-sm font-bold">UserCard</div>
            <div className="flex flex-col gap-1">
              <UserCard user={DEMO_USERS[0]} highlight subtitle="Ersteller · vor 2 Std." />
              <UserCard user={DEMO_USERS[1]} onClick={() => toast.info('Profil von Markus')} />
              <UserCard user={DEMO_USERS[2]} trailing={<StatusBadge status="open" />} />
            </div>
          </div>
        </div>
      </Section>

      <Section n="10" title="Feedback" sub="Lade · Leer · Toast">
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <div className="mb-3 font-display text-sm font-bold">Spinner & Skeleton</div>
            <div className="flex items-center gap-4">
              <Spinner size="sm" />
              <Spinner />
              <Spinner size="lg" />
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-4 w-1/2 rounded" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
          <div>
            <div className="mb-3 font-display text-sm font-bold">EmptyState</div>
            <EmptyState
              icon={<WingIcon size={26} />}
              title="Noch keine Treffen"
              description="Erstelle das erste Flugtreffen in deiner Region."
              action={<Button size="sm">Treffen erstellen</Button>}
            />
          </div>
          <div>
            <div className="mb-3 font-display text-sm font-bold">Toasts</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => toast.success('Teilnahme bestätigt 🪂')}>Success</Button>
              <Button size="sm" variant="outline" onClick={() => toast.error('Treffen ist ausgebucht')}>Error</Button>
              <Button size="sm" variant="outline" onClick={() => toast.info('Filter angewendet')}>Info</Button>
            </div>
          </div>
        </div>
      </Section>

      <Section n="11" title="Overlays" sub="Modal · Drawer">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setModalOpen(true)}>Modal öffnen</Button>
          <Button variant="outline" onClick={() => setDrawerOpen(true)}>Drawer öffnen</Button>
        </div>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Treffen absagen?"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Abbrechen</Button>
              <Button variant="accent" onClick={() => { setModalOpen(false); toast.success('Treffen abgesagt') }}>Absagen</Button>
            </>
          }
        >
          <p className="text-base-content/70">Alle Teilnehmenden werden benachrichtigt. Das lässt sich nicht rückgängig machen.</p>
        </Modal>
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Filter">
          <div className="flex flex-col gap-4">
            <SelectField label="Region">
              <option>Alle Regionen</option>
              <option>Allgäu</option>
              <option>Rhön</option>
            </SelectField>
            <Switch checked={freeOnly} onChange={setFreeOnly} label="Nur freie Plätze" />
            <Button onClick={() => setDrawerOpen(false)}>Anwenden</Button>
          </div>
        </Drawer>
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

      <Section n="12" title="Karte" sub="Leaflet · OSM">
        <MapShell className="h-80" zoom={6}>
          <Marker position={[47.5667, 10.75]} icon={pinIcon('sky')}>
            <Popup>Tegelberg · Allgäu</Popup>
          </Marker>
          <Marker position={[50.4986, 9.9389]} icon={pinIcon('coral')}>
            <Popup>Wasserkuppe · Rhön</Popup>
          </Marker>
        </MapShell>
      </Section>
    </div>
  )
}
