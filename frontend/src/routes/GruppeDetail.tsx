import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  useGroup,
  useGroupChannels,
  useGroupFeed,
  useGroupMembers,
  useJoinGroup,
  useLeaveGroup,
  useReactToPost,
  useRequestJoin,
} from '@/api/groups'
import type { GroupDetail as GroupDetailDto } from '@/api/schemas'
import { ChannelList } from '@/components/groups/ChannelList'
import { FeedPostCard } from '@/components/groups/FeedPostCard'
import { GroupHero } from '@/components/groups/GroupHero'
import { MemberList } from '@/components/groups/MemberList'
import { Button, Card, EmptyState, Modal, Skeleton, TextareaField } from '@/components/ui'
import { GroupIcon } from '@/components/layout/icons'

/** Beitritts-/Verwaltungs-Aktion abhängig von Mitgliedschaft & join_policy. */
function GroupAction({ group }: { group: GroupDetailDto }) {
  const join = useJoinGroup()
  const leave = useLeaveGroup()
  const request = useRequestJoin()
  const [reqOpen, setReqOpen] = useState(false)
  const [message, setMessage] = useState('')
  const pending = join.isPending || leave.isPending || request.isPending

  if (group.my_membership) {
    return (
      <>
        {group.can_manage && (
          <Link to={`/gruppen/${group.id}/einstellungen`} className="btn btn-primary btn-sm rounded-full">
            Verwalten
          </Link>
        )}
        {group.my_membership.role !== 'owner' && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => leave.mutate({ id: group.id })}>
            Verlassen
          </Button>
        )}
      </>
    )
  }

  if (group.join_policy === 'open')
    return (
      <Button size="sm" disabled={pending} onClick={() => join.mutate({ id: group.id })}>
        Beitreten
      </Button>
    )

  if (group.join_policy === 'request')
    return (
      <>
        <Button size="sm" disabled={pending} onClick={() => setReqOpen(true)}>
          Beitritt anfragen
        </Button>
        <Modal
          open={reqOpen}
          onClose={() => setReqOpen(false)}
          title="Beitritt anfragen"
          footer={
            <>
              <Button variant="ghost" onClick={() => setReqOpen(false)}>
                Abbrechen
              </Button>
              <Button
                disabled={pending}
                onClick={() =>
                  request.mutate({ id: group.id, message: message.trim() || null }, { onSuccess: () => setReqOpen(false) })
                }
              >
                Anfrage senden
              </Button>
            </>
          }
        >
          <TextareaField
            label="Nachricht (optional)"
            placeholder="Stell dich kurz vor…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Modal>
      </>
    )

  return (
    <span className="rounded-full bg-base-200 px-3 py-1.5 text-sm font-semibold text-base-content/55">Nur auf Einladung</span>
  )
}

/** Gruppendetail: Hero + Aktion, Feed (mit Reaktionen), Channels, Mitglieder. */
export function GruppeDetail() {
  const { id } = useParams()
  const groupId = Number(id)
  const group = useGroup(groupId)
  const channels = useGroupChannels(groupId)
  const feed = useGroupFeed(groupId)
  const members = useGroupMembers(groupId)
  const react = useReactToPost(groupId)

  if (group.isLoading)
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )

  if (group.isError || !group.data)
    return (
      <EmptyState
        icon={<GroupIcon size={26} />}
        title="Gruppe nicht gefunden"
        description="Diese Gruppe existiert nicht oder ist privat."
        action={
          <Link to="/gruppen" className="btn btn-primary btn-sm rounded-full">
            Zum Verzeichnis
          </Link>
        }
      />
    )

  const g = group.data

  return (
    <div className="flex flex-col gap-6">
      <Link to="/gruppen" className="text-sm font-semibold text-base-content/60 hover:text-base-content">
        ← Alle Gruppen
      </Link>

      <GroupHero group={g} action={<GroupAction group={g} />} />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-4">
          {g.description && (
            <Card className="p-5">
              <h2 className="mb-2 font-display text-lg">Über die Gruppe</h2>
              <p className="leading-relaxed text-base-content/80">{g.description}</p>
              {g.rules_text && <p className="mt-3 border-t border-base-300 pt-3 text-sm text-base-content/60">{g.rules_text}</p>}
            </Card>
          )}

          <h2 className="font-display text-xl">Feed</h2>
          {feed.isLoading && <Skeleton className="h-40 w-full" />}
          {feed.data && feed.data.length === 0 && (
            <Card className="px-6 py-10 text-center text-base-content/55">Noch keine Beiträge in dieser Gruppe.</Card>
          )}
          {feed.data?.map((post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              onReact={(emoji) => react.mutate({ postId: post.id, emoji })}
            />
          ))}
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="font-display text-lg">Channels</h2>
              <Link to={`/gruppen/${groupId}/channels`} className="text-xs font-semibold text-primary hover:underline">
                Öffnen →
              </Link>
            </div>
            {channels.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <ChannelList channels={channels.data ?? []} groupId={groupId} />
            )}
          </Card>
        </aside>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 font-display text-lg">Mitglieder ({g.members_count})</h2>
        {members.isLoading ? <Skeleton className="h-24 w-full" /> : <MemberList members={members.data ?? []} />}
      </Card>
    </div>
  )
}
