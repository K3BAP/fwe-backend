import { UserCard } from '@/components/ui'
import type { PublicUserCard } from '@/api/schemas'

/** Teilnehmerliste eines Treffens; der Organisator wird hervorgehoben (Coral-Ring + Label). */
export function ParticipantList({
  participants,
  creatorId,
}: {
  participants: PublicUserCard[]
  creatorId: number
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-2">
      {participants.map((p) => (
        <UserCard
          key={p.id}
          user={p}
          highlight={p.id === creatorId}
          subtitle={p.id === creatorId ? 'Organisator' : undefined}
        />
      ))}
    </div>
  )
}
