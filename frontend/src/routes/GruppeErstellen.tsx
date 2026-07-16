import { Link, useNavigate } from 'react-router-dom'
import { useCreateGroup } from '@/api/groups'
import { GroupForm } from '@/components/groups/GroupForm'
import { Card } from '@/components/ui'
import { toast } from '@/stores/toastStore'

/** „Gruppe erstellen" — schreibt über die Naht in den Mock-Store und öffnet die neue Gruppe. */
export function GruppeErstellen() {
  const navigate = useNavigate()
  const create = useCreateGroup()

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link to="/gruppen" className="text-sm font-semibold text-base-content/60 hover:text-base-content">
          ← Alle Gruppen
        </Link>
        <h1 className="mt-2 text-3xl">Gruppe erstellen</h1>
        <p className="mt-1 text-base-content/60">Gründe deine Community und lade Mitstreiter ein.</p>
      </div>

      <Card className="p-5 sm:p-7">
        <GroupForm
          submitting={create.isPending}
          onSubmit={(input) =>
            create.mutate(input, {
              onSuccess: (detail) => {
                toast.success('Gruppe erstellt! 🎉')
                navigate(`/gruppen/${detail.id}`)
              },
              onError: () => toast.error('Gruppe konnte nicht erstellt werden.'),
            })
          }
        />
      </Card>
    </div>
  )
}
