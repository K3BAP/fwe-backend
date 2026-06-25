import { Button, Card, ExperienceBadge, StatusBadge } from '@/components/ui'
import type { MeetupListItem } from '@/api/schemas'
import { formatMeetupDate } from '@/lib/format'

const ACTION_LABEL: Record<MeetupListItem['derived_status'], string> = {
  open: 'Teilnehmen',
  full: 'Ausgebucht',
  cancelled: 'Abgesagt',
  finished: 'Beendet',
}

/** Dashboard-Card eines Flugtreffens (Design-System §07). */
export function MeetupCard({ meetup }: { meetup: MeetupListItem }) {
  const joinable = meetup.derived_status === 'open'
  const seats = meetup.max_participants
    ? `${meetup.participant_count} von ${meetup.max_participants} Plätzen`
    : `${meetup.participant_count} Teilnehmende`

  return (
    <Card className="flex flex-col overflow-hidden shadow-hover">
      <div className="relative h-38" style={{ background: 'linear-gradient(180deg,#4FA8EE 0%,#86C9F4 48%,#C7E6FA 100%)' }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(130px 90px at 82% 18%,rgba(255,193,120,.62),rgba(255,193,120,0) 70%)' }} />
        <svg className="absolute bottom-0 left-0 h-15 w-full" viewBox="0 0 540 60" preserveAspectRatio="none" aria-hidden>
          <path d="M0 38 L90 20 L160 36 L250 12 L340 34 L430 16 L540 32 L540 60 L0 60 Z" fill="#3E7C84" />
          <path d="M0 50 L120 40 L240 50 L360 38 L470 50 L540 44 L540 60 L0 60 Z" fill="#2A5C63" />
        </svg>
        <span className="absolute right-3 top-3">
          <StatusBadge status={meetup.derived_status} />
        </span>
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-[rgba(14,23,38,.5)] px-2.5 py-1 text-xs font-semibold text-white">
          📍 {meetup.spot_name}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4.5">
        <div className="mb-2 flex flex-wrap gap-2">
          <ExperienceBadge level={meetup.experience_level} />
          <span className="rounded-full border-[1.5px] border-base-300 px-3 py-1 text-xs font-semibold">
            {formatMeetupDate(meetup.starts_at)}
          </span>
        </div>
        <h3 className="font-display text-lg">{meetup.title}</h3>
        <div className="mb-3.5 mt-1 text-[13px] text-base-content/60">📍 {meetup.spot_name} · {meetup.region}</div>
        <div className="mt-auto flex items-center justify-between">
          <span className="text-sm font-semibold text-base-content/70">{seats}</span>
          <Button size="sm" disabled={!joinable} variant={joinable ? 'primary' : 'outline'}>
            {ACTION_LABEL[meetup.derived_status]}
          </Button>
        </div>
      </div>
    </Card>
  )
}
