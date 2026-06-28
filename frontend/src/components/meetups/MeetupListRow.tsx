import { Link } from 'react-router-dom'
import { ExperienceBadge, StatusBadge } from '@/components/ui'
import type { MeetupListItem } from '@/api/schemas'
import { cn } from '@/lib/cn'
import { formatMeetupDate } from '@/lib/format'

/**
 * Kompakte horizontale Listenzeile für den Desktop-Split (Liste links neben der Karte). `selected`
 * hebt die Zeile hervor, wenn das zugehörige Treffen auf der Karte angeklickt wurde (Anker-`id` zum
 * Einscrollen).
 */
export function MeetupListRow({ meetup, selected }: { meetup: MeetupListItem; selected?: boolean }) {
  const hasCap = meetup.max_participants != null
  const seats = hasCap ? `${meetup.participant_count}/${meetup.max_participants} Plätze` : `${meetup.participant_count} Teilnehmende`
  const free =
    hasCap && meetup.free_spots != null && meetup.free_spots > 0
      ? { text: `${meetup.free_spots} frei`, open: true }
      : hasCap
        ? { text: 'ausgebucht', open: false }
        : null

  return (
    <Link
      to={`/flugtreffen/${meetup.id}`}
      id={`meetup-row-${meetup.id}`}
      className={cn(
        'group flex gap-3.5 rounded-[18px] border bg-base-100 p-3 shadow-card transition hover:shadow-hover',
        selected ? 'border-primary ring-2 ring-primary/25' : 'border-base-300 hover:border-primary/40',
      )}
    >
      <div
        className="relative size-[78px] shrink-0 overflow-hidden rounded-[14px]"
        style={{ background: 'linear-gradient(180deg,#4FA8EE,#86C9F4 55%,#C7E6FA)' }}
        aria-hidden
      >
        <svg className="absolute bottom-0 h-6 w-full" viewBox="0 0 78 26" preserveAspectRatio="none">
          <path d="M0 16 L20 8 L40 14 L60 6 L78 14 L78 26 L0 26 Z" fill="rgba(43,92,99,.9)" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          <ExperienceBadge level={meetup.experience_level} />
          <StatusBadge status={meetup.derived_status} />
        </div>
        <div className="truncate font-display text-[15px] font-bold leading-tight">{meetup.title}</div>
        <div className="mt-0.5 truncate text-xs text-base-content/55">
          {meetup.region} · {formatMeetupDate(meetup.starts_at)}
        </div>
        <div className="mt-1 text-xs font-semibold text-base-content/70">
          {seats}
          {free && <> · <span className={free.open ? 'text-success' : 'text-base-content/50'}>{free.text}</span></>}
        </div>
      </div>
    </Link>
  )
}
