import { Avatar, Card, ExperienceBadge } from '@/components/ui'
import type { Profile } from '@/api/schemas'
import { brandGradient } from '@/lib/gradient'

/** Profil-Kopf: Verlaufsbanner, Avatar, Name/@handle, Level + Heimatregion, Bio. */
export function ProfileHeader({ profile }: { profile: Profile }) {
  return (
    <Card className="overflow-hidden">
      <div className="h-28" style={{ background: brandGradient(profile.display_name) }} />
      <div className="px-5 pb-5">
        <Avatar name={profile.display_name} src={profile.avatar_path} size={88} className="-mt-12 ring-4 ring-base-100" />
        <div className="mt-3">
          <h1 className="font-display text-2xl leading-tight">{profile.display_name}</h1>
          {profile.handle && <div className="text-sm text-base-content/55">@{profile.handle}</div>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {profile.experience_level && <ExperienceBadge level={profile.experience_level} />}
          {profile.home_region && (
            <span className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-secondary/30 bg-base-100 px-3 py-1.5 text-[13px] font-medium text-secondary">
              📍 {profile.home_region}
            </span>
          )}
        </div>
        {profile.bio && <p className="mt-4 whitespace-pre-line leading-relaxed text-base-content/80">{profile.bio}</p>}
      </div>
    </Card>
  )
}
