import { Link, useNavigate, useParams } from 'react-router-dom'
import { useOpenDm } from '@/api/chat'
import { useProfile } from '@/api/profiles'
import type { Profile } from '@/api/schemas'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { Button, Card, EmptyState, Skeleton } from '@/components/ui'
import { GroupIcon } from '@/components/layout/icons'

function ProfileStats({ profile }: { profile: Profile }) {
  const items = [
    profile.flight_hours != null ? { label: 'Flugstunden', value: `${profile.flight_hours} h` } : null,
    profile.license_class ? { label: 'Lizenz', value: profile.license_class } : null,
    profile.glider ? { label: 'Schirm', value: profile.glider } : null,
    profile.home_region ? { label: 'Heimatregion', value: profile.home_region } : null,
  ].filter((x): x is { label: string; value: string } => x !== null)

  if (items.length === 0) return null
  return (
    <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label}>
          <div className="text-xs font-semibold uppercase tracking-wide text-base-content/45">{it.label}</div>
          <div className="mt-1 font-display text-lg">{it.value}</div>
        </div>
      ))}
    </Card>
  )
}

/** Öffentliche Profilseite. Self → Bearbeiten; sonst → Direktchat öffnen. */
export function Profil() {
  const { id } = useParams()
  const userId = Number(id)
  const { data: p, isLoading, isError } = useProfile(userId)
  const openDm = useOpenDm()
  const navigate = useNavigate()

  if (isLoading)
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )

  if (isError || !p)
    return (
      <EmptyState
        icon={<GroupIcon size={26} />}
        title="Profil nicht gefunden"
        description="Dieser Pilot existiert nicht."
        action={
          <Link to="/" className="btn btn-primary btn-sm rounded-full">
            Zum Dashboard
          </Link>
        }
      />
    )

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <ProfileHeader profile={p} />
      <ProfileStats profile={p} />

      <Card className="flex flex-wrap items-center gap-3 p-5">
        {p.is_self ? (
          <>
            <Link to="/profil/bearbeiten" className="btn btn-primary rounded-full">
              Profil bearbeiten
            </Link>
            <Link to="/einstellungen" className="btn btn-outline rounded-full border-[1.5px] border-base-300 text-primary">
              Einstellungen
            </Link>
          </>
        ) : (
          <Button
            disabled={openDm.isPending}
            onClick={() => openDm.mutate(userId, { onSuccess: (convId) => navigate(`/chat/${convId}`) })}
          >
            Direktchat öffnen
          </Button>
        )}
      </Card>
    </div>
  )
}
