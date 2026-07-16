import { Link, useNavigate } from 'react-router-dom'
import { useProfile, useUpdateProfile, useUploadAvatar } from '@/api/profiles'
import { ProfileEditForm } from '@/components/profile/ProfileEditForm'
import { Card, Skeleton } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/stores/toastStore'

/** „Profil bearbeiten" für den Session-User. */
export function ProfilBearbeiten() {
  const navigate = useNavigate()
  const meId = useAuthStore((s) => s.user?.id ?? 1)
  const { data: profile, isLoading } = useProfile(meId)
  const update = useUpdateProfile()
  const uploadAvatar = useUploadAvatar()

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link to={`/profil/${meId}`} className="text-sm font-semibold text-base-content/60 hover:text-base-content">
          ← Zurück zum Profil
        </Link>
        <h1 className="mt-2 text-3xl">Profil bearbeiten</h1>
      </div>

      <Card className="p-5 sm:p-7">
        {isLoading || !profile ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <ProfileEditForm
            profile={profile}
            submitting={update.isPending}
            onAvatarFile={(file) =>
              uploadAvatar.mutate(file, {
                onSuccess: () => toast.success('Avatar aktualisiert.'),
                onError: () => toast.error('Avatar konnte nicht hochgeladen werden.'),
              })
            }
            onSubmit={(input) =>
              update.mutate(input, {
                onSuccess: () => {
                  toast.success('Profil gespeichert.')
                  navigate(`/profil/${meId}`)
                },
                onError: () => toast.error('Profil konnte nicht gespeichert werden.'),
              })
            }
          />
        )}
      </Card>
    </div>
  )
}
