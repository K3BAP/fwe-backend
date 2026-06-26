import { UserCard } from '@/components/ui'
import type { PublicUserCard } from '@/api/schemas'
import { ProfileHovercard } from '@/components/profile/ProfileHovercard'

/** Teilnehmerliste eines Treffens; Organisator hervorgehoben. `onRemove` zeigt dem Organisator ✕. */
export function ParticipantList({
  participants,
  creatorId,
  onRemove,
}: {
  participants: PublicUserCard[]
  creatorId: number
  onRemove?: (userId: number) => void
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-2">
      {participants.map((p) => (
        <div key={p.id} className="flex items-center gap-1">
          <ProfileHovercard userId={p.id} className="min-w-0 flex-1">
            <UserCard
              user={p}
              highlight={p.id === creatorId}
              subtitle={p.id === creatorId ? 'Organisator' : undefined}
            />
          </ProfileHovercard>
          {onRemove && p.id !== creatorId && (
            <button
              type="button"
              onClick={() => onRemove(p.id)}
              aria-label={`${p.display_name} entfernen`}
              className="btn btn-circle btn-ghost btn-sm shrink-0 text-base-content/40 hover:text-error"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
