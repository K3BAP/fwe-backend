import { Link, useParams } from 'react-router-dom'
import {
  useApproveRequest,
  useCreateInvite,
  useGroup,
  useGroupInvites,
  useGroupRequests,
  useRejectRequest,
  useRevokeInvite,
} from '@/api/groups'
import type { GroupInvite } from '@/api/schemas'
import { JoinRequestRow } from '@/components/groups/JoinRequestRow'
import { Button, Card, EmptyState, Skeleton } from '@/components/ui'
import { GroupIcon } from '@/components/layout/icons'

const INVITE_STATUS: Record<GroupInvite['status'], string> = {
  pending: 'Offen',
  accepted: 'Angenommen',
  revoked: 'Widerrufen',
  expired: 'Abgelaufen',
}

/** Admin-Bereich einer Gruppe: Beitrittsanfragen entscheiden, Einladungen verwalten. */
export function GruppeEinstellungen() {
  const { id } = useParams()
  const groupId = Number(id)
  const group = useGroup(groupId)
  const canManage = group.data?.can_manage ?? false

  const requests = useGroupRequests(groupId, canManage)
  const invites = useGroupInvites(groupId, canManage)
  const approve = useApproveRequest()
  const reject = useRejectRequest()
  const createInvite = useCreateInvite()
  const revokeInvite = useRevokeInvite()
  const decisionPending = approve.isPending || reject.isPending

  if (group.isLoading) return <Skeleton className="h-64 w-full" />

  if (!group.data || !canManage)
    return (
      <EmptyState
        icon={<GroupIcon size={26} />}
        title="Kein Zugriff"
        description="Nur Owner und Admins können diese Gruppe verwalten."
        action={
          <Link to="/gruppen" className="btn btn-primary btn-sm rounded-full">
            Zum Verzeichnis
          </Link>
        }
      />
    )

  const g = group.data

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link to={`/gruppen/${groupId}`} className="text-sm font-semibold text-base-content/60 hover:text-base-content">
          ← Zurück zur Gruppe
        </Link>
        <h1 className="mt-2 text-3xl">Verwaltung</h1>
        <p className="mt-1 text-base-content/60">{g.name}</p>
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl">Beitrittsanfragen</h2>
        {requests.isLoading && <Skeleton className="h-24 w-full" />}
        {requests.data && requests.data.length === 0 && (
          <Card className="px-6 py-8 text-center text-base-content/55">Keine offenen Anfragen.</Card>
        )}
        <div className="flex flex-col gap-3">
          {requests.data?.map((r) => (
            <JoinRequestRow
              key={r.id}
              request={r}
              pending={decisionPending}
              onApprove={() => approve.mutate({ groupId, requestId: r.id })}
              onReject={() => reject.mutate({ groupId, requestId: r.id })}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl">Einladungen</h2>
          <Button size="sm" variant="outline" disabled={createInvite.isPending} onClick={() => createInvite.mutate({ groupId })}>
            + Einladungslink
          </Button>
        </div>
        {invites.isLoading && <Skeleton className="h-20 w-full" />}
        {invites.data && invites.data.length === 0 && (
          <Card className="px-6 py-8 text-center text-base-content/55">Noch keine Einladungen.</Card>
        )}
        <div className="flex flex-col gap-2">
          {invites.data?.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-3 rounded-2xl border border-base-300 bg-base-100 p-3">
              <div className="min-w-0">
                {inv.invited_user ? (
                  <span>
                    Eingeladen: <span className="font-semibold">{inv.invited_user.display_name}</span>
                  </span>
                ) : (
                  <span className="break-all font-mono text-sm">🔗 {inv.token}</span>
                )}
                <div className="text-xs text-base-content/50">
                  {inv.token && inv.max_uses != null ? `${inv.uses_count}/${inv.max_uses} genutzt · ` : ''}
                  {INVITE_STATUS[inv.status]}
                </div>
              </div>
              <Button size="sm" variant="ghost" disabled={revokeInvite.isPending} onClick={() => revokeInvite.mutate({ groupId, inviteId: inv.id })}>
                Widerrufen
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
