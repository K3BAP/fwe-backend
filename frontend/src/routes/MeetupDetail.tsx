import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Marker } from 'react-leaflet'
import {
  useCancelMeetup,
  useDeleteMeetup,
  useJoinMeetup,
  useLeaveMeetup,
  useMeetup,
  useRemoveParticipant,
} from '@/api/meetups'
import type { MeetupDetail as MeetupDetailDto, PublicUserCard } from '@/api/schemas'
import { MeetupEditModal } from '@/components/meetups/MeetupEditModal'
import { ParticipantList } from '@/components/meetups/ParticipantList'
import { WeatherPanel } from '@/components/meetups/WeatherPanel'
import { MapShell } from '@/components/map/MapShell'
import { pinIcon } from '@/components/map/pin'
import { Button, Card, EmptyState, ExperienceBadge, Modal, Skeleton, StatusBadge } from '@/components/ui'
import { CalendarIcon, ChatIcon, MapPinIcon, UsersIcon, WingIcon } from '@/components/layout/icons'
import { formatMeetupDate } from '@/lib/format'
import { toast } from '@/stores/toastStore'

/** Organisator-Steuerung: Bearbeiten / Absagen / Löschen (mit Bestätigung). */
function OrganizerActions({ m }: { m: MeetupDetailDto }) {
  const cancel = useCancelMeetup()
  const del = useDeleteMeetup()
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const active = m.derived_status !== 'cancelled' && m.derived_status !== 'finished'

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={() => setEditOpen(true)}>Bearbeiten</Button>
      {active && (
        <Button variant="outline" onClick={() => setCancelOpen(true)}>
          Treffen absagen
        </Button>
      )}
      <Button variant="ghost" className="text-error" onClick={() => setDeleteOpen(true)}>
        Löschen
      </Button>

      {editOpen && <MeetupEditModal meetupId={m.id} onClose={() => setEditOpen(false)} />}

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Treffen absagen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Abbrechen
            </Button>
            <Button variant="accent" disabled={cancel.isPending} onClick={() => cancel.mutate(m.id, { onSuccess: () => setCancelOpen(false) })}>
              Absagen
            </Button>
          </>
        }
      >
        <p className="text-base-content/70">Alle Teilnehmenden sehen das Treffen als abgesagt. Es bleibt sichtbar.</p>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Treffen löschen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="accent"
              disabled={del.isPending}
              onClick={() => del.mutate(m.id, { onSuccess: () => { toast.success('Treffen gelöscht.'); navigate('/flugtreffen') } })}
            >
              Löschen
            </Button>
          </>
        }
      >
        <p className="text-base-content/70">Das Treffen wird unwiderruflich entfernt.</p>
      </Modal>
    </div>
  )
}

/** Teilnahme-Aktion abhängig von Rolle/Status (optimistisch, Toast in den Hooks). */
function ActionArea({ m }: { m: MeetupDetailDto }) {
  const join = useJoinMeetup()
  const leave = useLeaveMeetup()
  const pending = join.isPending || leave.isPending

  if (m.can_edit) return <OrganizerActions m={m} />
  if (m.derived_status === 'cancelled')
    return <p className="rounded-2xl bg-error/10 px-4 py-3 text-center text-sm font-semibold text-error">Dieses Treffen wurde abgesagt.</p>
  if (m.derived_status === 'finished')
    return <p className="rounded-2xl bg-base-200 px-4 py-3 text-center text-sm font-semibold text-base-content/60">Dieses Treffen ist beendet.</p>
  if (m.is_participant)
    return (
      <Button variant="outline" className="w-full" disabled={pending} onClick={() => leave.mutate(m.id)}>
        Teilnahme absagen
      </Button>
    )
  if (m.derived_status === 'full')
    return (
      <Button variant="outline" className="w-full" disabled>
        Ausgebucht
      </Button>
    )
  return (
    <Button className="w-full" disabled={pending} onClick={() => join.mutate(m.id)}>
      Teilnehmen
    </Button>
  )
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600">{icon}</span>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-base-content/45">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  )
}

/** Flugtreffen-Detailseite: Hero, Eckdaten, Beschreibung, Teilnehmer, Karte, Teilnahme-Aktion. */
export function MeetupDetail() {
  const { id } = useParams()
  const meetupId = Number(id)
  const { data: m, isLoading, isError } = useMeetup(meetupId)
  const removeP = useRemoveParticipant(meetupId)
  const [removingParticipant, setRemovingParticipant] = useState<PublicUserCard | null>(null)

  if (isLoading)
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    )

  if (isError || !m)
    return (
      <EmptyState
        icon={<WingIcon size={26} />}
        title="Treffen nicht gefunden"
        description="Dieses Flugtreffen existiert nicht oder wurde entfernt."
        action={
          <Link to="/flugtreffen" className="btn btn-primary btn-sm rounded-full">
            Zur Übersicht
          </Link>
        }
      />
    )

  const seats = m.max_participants
    ? `${m.participant_count} von ${m.max_participants} Plätzen${m.free_spots ? ` · ${m.free_spots} frei` : ''}`
    : `${m.participant_count} Teilnehmende`

  return (
    <div className="flex flex-col gap-6">
      <Link to="/flugtreffen" className="text-sm font-semibold text-base-content/60 hover:text-base-content">
        ← Alle Flugtreffen
      </Link>

      <Card className="relative h-48 overflow-hidden" style={{ background: 'linear-gradient(180deg,#4FA8EE 0%,#86C9F4 48%,#C7E6FA 100%)' }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(220px 140px at 84% 16%,rgba(255,193,120,.62),rgba(255,193,120,0) 70%)' }} />
        <svg className="absolute bottom-0 left-0 h-20 w-full" viewBox="0 0 540 70" preserveAspectRatio="none" aria-hidden>
          <path d="M0 44 L90 22 L160 42 L250 14 L340 40 L430 18 L540 38 L540 70 L0 70 Z" fill="#3E7C84" />
          <path d="M0 58 L120 46 L240 58 L360 44 L470 58 L540 50 L540 70 L0 70 Z" fill="#2A5C63" />
        </svg>
        <span className="absolute left-4 top-4">
          <ExperienceBadge level={m.experience_level} />
        </span>
        <span className="absolute right-4 top-4">
          <StatusBadge status={m.derived_status} />
        </span>
        <span className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-[rgba(14,23,38,.5)] px-3 py-1.5 text-sm font-semibold text-white">
          📍 {m.spot_name} · {m.region}
        </span>
      </Card>

      <h1 className="text-3xl">{m.title}</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4 p-5">
            <InfoRow icon={<CalendarIcon size={20} />} label="Wann" value={formatMeetupDate(m.starts_at)} />
            <InfoRow icon={<MapPinIcon size={20} />} label="Treffpunkt" value={`${m.spot_name} · ${m.region}`} />
            <InfoRow icon={<UsersIcon size={20} />} label="Plätze" value={seats} />
          </Card>

          {m.description && (
            <Card className="p-5">
              <h2 className="mb-2 font-display text-lg">Beschreibung</h2>
              <p className="whitespace-pre-line leading-relaxed text-base-content/80">{m.description}</p>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="mb-3 font-display text-lg">Teilnehmende ({m.participant_count})</h2>
            <ParticipantList
              participants={m.participants}
              creatorId={m.creator_user_id}
              onRemove={m.can_edit ? (uid) => setRemovingParticipant(m.participants.find((p) => p.id === uid) ?? null) : undefined}
            />
          </Card>

          {/* Treffen-Chat nur für Teilnehmende: Zugriff auf die Konversation ist serverseitig auf
              `meetup_participants` beschränkt — ohne Teilnahme führte der Link in ein 403/Lade-Fenster. */}
          {m.conversation_id != null && m.is_participant && (
            <Link to={`/chat/${m.conversation_id}`} className="block">
              <Card className="flex items-center justify-between gap-3 p-5 transition hover:border-primary/40 hover:bg-base-200/40">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-coral-50 text-coral-600">
                    <ChatIcon size={20} />
                  </span>
                  <div>
                    <div className="font-display">Treffen-Chat</div>
                    <div className="text-sm text-base-content/55">Sprich dich mit den Teilnehmenden ab.</div>
                  </div>
                </div>
                <span className="text-lg text-base-content/40">→</span>
              </Card>
            </Link>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4 p-5">
            <ActionArea m={m} />
            {m.lat != null && m.lng != null && (
              <MapShell className="h-44" center={[m.lat, m.lng]} zoom={11}>
                <Marker position={[m.lat, m.lng]} icon={pinIcon('coral')} />
              </MapShell>
            )}
          </Card>

          {/* Ohne Startplatz-Koordinaten (gelöschter Spot) gibt es kein Wetter — wie bei der Karte. */}
          {m.lat != null && m.lng != null && <WeatherPanel meetupId={m.id} startsAt={m.starts_at} />}
        </aside>
      </div>

      <Modal
        open={removingParticipant != null}
        onClose={() => setRemovingParticipant(null)}
        title="Teilnehmer entfernen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemovingParticipant(null)}>
              Abbrechen
            </Button>
            <Button
              variant="accent"
              disabled={removeP.isPending}
              onClick={() => {
                if (removingParticipant) removeP.mutate(removingParticipant.id, { onSuccess: () => setRemovingParticipant(null) })
              }}
            >
              Entfernen
            </Button>
          </>
        }
      >
        <p className="text-base-content/70">
          <span className="font-semibold">{removingParticipant?.display_name}</span> wird aus diesem Flugtreffen entfernt.
        </p>
      </Modal>
    </div>
  )
}
