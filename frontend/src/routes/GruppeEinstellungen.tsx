import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  useApproveRequest,
  useCreateDirectedInvite,
  useCreateInvite,
  useDeleteGroup,
  useGroup,
  useGroupInvites,
  useGroupMembers,
  useGroupRequests,
  useRejectRequest,
  useRemoveMember,
  useRevokeInvite,
  useSetMemberRole,
  useToggleBan,
  useTransferOwnership,
  useUpdateGroup,
} from '@/api/groups'
import type { GroupInvite, GroupMember } from '@/api/schemas'
import { GroupChannelManager } from '@/components/groups/GroupChannelManager'
import { GroupForm } from '@/components/groups/GroupForm'
import { JoinRequestRow } from '@/components/groups/JoinRequestRow'
import { MemberList } from '@/components/groups/MemberList'
import { Button, Card, EmptyState, Modal, Skeleton, UserPicker, type MenuItemDef } from '@/components/ui'
import { GroupIcon } from '@/components/layout/icons'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/stores/toastStore'

const INVITE_STATUS: Record<GroupInvite['status'], string> = {
  pending: 'Offen',
  accepted: 'Angenommen',
  revoked: 'Widerrufen',
  expired: 'Abgelaufen',
}

/** Admin-Bereich: Metadaten, Mitglieder verwalten, Anfragen, Einladungen, Gruppe löschen. */
export function GruppeEinstellungen() {
  const { id } = useParams()
  const groupId = Number(id)
  const navigate = useNavigate()
  const currentUserId = useAuthStore((s) => s.user?.id ?? 0)
  const group = useGroup(groupId)
  const canManage = group.data?.can_manage ?? false

  const members = useGroupMembers(groupId)
  const requests = useGroupRequests(groupId, canManage)
  const invites = useGroupInvites(groupId, canManage)
  const approve = useApproveRequest()
  const reject = useRejectRequest()
  const createInvite = useCreateInvite()
  const createDirectedInvite = useCreateDirectedInvite(groupId)
  const revokeInvite = useRevokeInvite()
  const update = useUpdateGroup(groupId)
  const del = useDeleteGroup()
  const setRole = useSetMemberRole(groupId)
  const removeMember = useRemoveMember(groupId)
  const toggleBan = useToggleBan(groupId)
  const transfer = useTransferOwnership(groupId)
  const [deleteOpen, setDeleteOpen] = useState(false)
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
  const isOwner = g.my_membership?.role === 'owner'

  const memberActions = (m: GroupMember): MenuItemDef[] => {
    if (m.user.id === currentUserId || m.role === 'owner') return []
    const items: MenuItemDef[] = []
    if (m.role !== 'admin') items.push({ label: 'Zu Admin machen', onSelect: () => setRole.mutate({ userId: m.user.id, role: 'admin' }) })
    if (m.role !== 'moderator') items.push({ label: 'Zu Moderator machen', onSelect: () => setRole.mutate({ userId: m.user.id, role: 'moderator' }) })
    if (m.role !== 'member') items.push({ label: 'Zu Mitglied machen', onSelect: () => setRole.mutate({ userId: m.user.id, role: 'member' }) })
    items.push({ label: m.status === 'banned' ? 'Entbannen' : 'Bannen', onSelect: () => toggleBan.mutate(m.user.id) })
    if (isOwner) items.push({ label: 'Owner übertragen', onSelect: () => transfer.mutate(m.user.id) })
    items.push({ label: 'Entfernen', danger: true, onSelect: () => removeMember.mutate(m.user.id) })
    return items
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <Link to={`/gruppen/${groupId}`} className="text-sm font-semibold text-base-content/60 hover:text-base-content">
          ← Zurück zur Gruppe
        </Link>
        <h1 className="mt-2 text-3xl">Verwaltung</h1>
        <p className="mt-1 text-base-content/60">{g.name}</p>
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl">Mitglieder ({members.data?.length ?? g.members_count})</h2>
        {members.isLoading ? <Skeleton className="h-24 w-full" /> : <MemberList members={members.data ?? []} actions={memberActions} />}
      </section>

      <GroupChannelManager groupId={groupId} groupName={g.name} />

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
        <div className="mb-3">
          <UserPicker
            label="Pilot gezielt einladen"
            exclude={[
              ...(members.data?.map((m) => m.user.id) ?? []),
              ...(invites.data?.filter((i) => i.invited_user).map((i) => i.invited_user!.id) ?? []),
            ]}
            onSelect={(u) => createDirectedInvite.mutate(u.id)}
          />
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

      <section>
        <h2 className="mb-3 font-display text-xl">Metadaten</h2>
        <Card className="p-5 sm:p-6">
          <GroupForm initial={g} submitting={update.isPending} onSubmit={(input) => update.mutate(input)} />
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl text-error">Gefahrenzone</h2>
        <Card className="flex flex-col gap-3 border-error/30 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold">Gruppe löschen</div>
            <div className="text-sm text-base-content/55">Entfernt die Gruppe samt Inhalten. Das lässt sich nicht rückgängig machen.</div>
          </div>
          <Button variant="accent" className="shrink-0" onClick={() => setDeleteOpen(true)}>
            Gruppe löschen
          </Button>
        </Card>
      </section>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Gruppe löschen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="accent"
              disabled={del.isPending}
              onClick={() => del.mutate(groupId, { onSuccess: () => { toast.success('Gruppe gelöscht.'); navigate('/gruppen') } })}
            >
              Endgültig löschen
            </Button>
          </>
        }
      >
        <p className="text-base-content/70">
          „{g.name}" und alle Beiträge, Channels und Mitgliedschaften werden entfernt.
        </p>
      </Modal>
    </div>
  )
}
