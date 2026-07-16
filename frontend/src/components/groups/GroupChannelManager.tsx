import { useState } from 'react'
import { useCreateChannel, useDeleteChannel, useGroupChannels, useRenameChannel } from '@/api/groups'
import type { GroupChannel } from '@/api/schemas'
import { Button, Menu, Modal, Skeleton } from '@/components/ui'
import { ChannelDialog } from './ChannelDialog'

/** Channel-Verwaltung im Admin-Bereich: anlegen / umbenennen / löschen (Standard-Channel geschützt). */
export function GroupChannelManager({ groupId, groupName }: { groupId: number; groupName: string }) {
  const channels = useGroupChannels(groupId)
  const create = useCreateChannel(groupId)
  const rename = useRenameChannel(groupId)
  const del = useDeleteChannel(groupId)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [renaming, setRenaming] = useState<GroupChannel | null>(null)
  const [session, setSession] = useState(0)
  const [deleting, setDeleting] = useState<GroupChannel | null>(null)

  const open = (channel: GroupChannel | null) => {
    setRenaming(channel)
    setSession((s) => s + 1)
    setDialogOpen(true)
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl">Channels</h2>
        <Button size="sm" variant="outline" onClick={() => open(null)}>
          + Channel
        </Button>
      </div>

      {channels.isLoading && <Skeleton className="h-20 w-full" />}
      <div className="flex flex-col gap-2">
        {channels.data?.map((c) => (
          <div key={c.conversation_id} className="flex items-center justify-between gap-2 rounded-2xl border border-base-300 bg-base-100 p-3">
            <span className="font-medium">
              <span className="text-base-content/40">#</span> {c.name}
              {c.is_default && <span className="ml-2 text-xs text-base-content/45">Standard</span>}
            </span>
            <Menu
              label="Channel"
              items={[
                { label: 'Umbenennen', onSelect: () => open(c) },
                ...(c.is_default ? [] : [{ label: 'Löschen', danger: true, onSelect: () => setDeleting(c) }]),
              ]}
            />
          </div>
        ))}
      </div>

      <ChannelDialog
        key={session}
        open={dialogOpen}
        initialName={renaming?.name}
        submitting={create.isPending || rename.isPending}
        onClose={() => setDialogOpen(false)}
        onSubmit={(name) => {
          if (renaming) rename.mutate({ conversationId: renaming.conversation_id, name }, { onSuccess: () => setDialogOpen(false) })
          else create.mutate({ name, groupTitle: groupName }, { onSuccess: () => setDialogOpen(false) })
        }}
      />

      <Modal
        open={deleting != null}
        onClose={() => setDeleting(null)}
        title="Channel löschen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Abbrechen
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                if (deleting) del.mutate(deleting.conversation_id)
                setDeleting(null)
              }}
            >
              Löschen
            </Button>
          </>
        }
      >
        <p className="text-base-content/70"># {deleting?.name} und alle Nachrichten darin werden entfernt.</p>
      </Modal>
    </section>
  )
}
