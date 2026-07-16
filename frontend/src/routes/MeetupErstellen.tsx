import { Link, useNavigate } from 'react-router-dom'
import { useCreateMeetup } from '@/api/meetups'
import { MeetupForm } from '@/components/meetups/MeetupForm'
import { Card } from '@/components/ui'
import { toast } from '@/stores/toastStore'

/** „Treffen erstellen" — der mehrstufige Wizard schreibt über die Naht in den Mock-Store. */
export function MeetupErstellen() {
  const navigate = useNavigate()
  const create = useCreateMeetup()

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link to="/flugtreffen" className="text-sm font-semibold text-base-content/60 hover:text-base-content">
          ← Alle Flugtreffen
        </Link>
        <h1 className="mt-2 text-3xl">Treffen erstellen</h1>
        <p className="mt-1 text-base-content/60">In drei Schritten zum gemeinsamen Flugtag.</p>
      </div>

      <Card className="p-5 sm:p-7">
        <MeetupForm
          submitting={create.isPending}
          onSubmit={(input) =>
            create.mutate(input, {
              onSuccess: (detail) => {
                toast.success('Treffen erstellt! 🪂')
                navigate(`/flugtreffen/${detail.id}`)
              },
              onError: () => toast.error('Treffen konnte nicht erstellt werden.'),
            })
          }
        />
      </Card>
    </div>
  )
}
