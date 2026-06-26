import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMeetup, useUpdateMeetup } from '@/api/meetups'
import { MeetupForm } from '@/components/meetups/MeetupForm'
import { Card, EmptyState, Skeleton } from '@/components/ui'
import { WingIcon } from '@/components/layout/icons'
import { toast } from '@/stores/toastStore'

/** „Treffen bearbeiten" (Organisator) — reuse MeetupForm im Bearbeiten-Modus. */
export function MeetupBearbeiten() {
  const { id } = useParams()
  const meetupId = Number(id)
  const navigate = useNavigate()
  const { data: m, isLoading } = useMeetup(meetupId)
  const update = useUpdateMeetup(meetupId)

  if (isLoading) return <Skeleton className="mx-auto h-96 max-w-2xl" />

  if (!m || !m.can_edit)
    return (
      <EmptyState
        icon={<WingIcon size={26} />}
        title="Kein Zugriff"
        description="Nur der Organisator kann dieses Treffen bearbeiten."
        action={
          <Link to="/flugtreffen" className="btn btn-primary btn-sm rounded-full">
            Zur Übersicht
          </Link>
        }
      />
    )

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link to={`/flugtreffen/${meetupId}`} className="text-sm font-semibold text-base-content/60 hover:text-base-content">
          ← Zurück zum Treffen
        </Link>
        <h1 className="mt-2 text-3xl">Treffen bearbeiten</h1>
      </div>

      <Card className="p-5 sm:p-7">
        <MeetupForm
          initial={m}
          submitting={update.isPending}
          onSubmit={(input) =>
            update.mutate(input, {
              onSuccess: () => {
                toast.success('Treffen gespeichert.')
                navigate(`/flugtreffen/${meetupId}`)
              },
              onError: () => toast.error('Speichern fehlgeschlagen.'),
            })
          }
        />
      </Card>
    </div>
  )
}
