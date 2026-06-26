import { UserCard } from '@/components/ui'
import type { PublicUserCard } from '@/api/schemas'
import { ProfileHovercard } from '@/components/profile/ProfileHovercard'

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
        <ProfileHovercard key={p.id} userId={p.id}>
          <UserCard
            user={p}
            highlight={p.id === creatorId}
            subtitle={p.id === creatorId ? 'Organisator' : undefined}
          />
        </ProfileHovercard>
      ))}
    </div>
  )
}
