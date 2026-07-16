import { Link, useParams } from 'react-router-dom'
import { useGroup, useGroupChannels } from '@/api/groups'
import { ChatThread } from '@/components/chat/ChatThread'
import { ChannelList } from '@/components/groups/ChannelList'
import { ChannelsLocked } from '@/components/groups/ChannelsLocked'
import { Card, Skeleton } from '@/components/ui'
import { ChatIcon } from '@/components/layout/icons'
import { cn } from '@/lib/cn'

function ChannelEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-base-200 text-primary">
        <ChatIcon size={26} />
      </span>
      <p className="font-display text-lg">Wähle einen Channel</p>
      <p className="max-w-xs text-sm text-base-content/55">Tausch dich mit den Mitgliedern dieser Gruppe aus.</p>
    </div>
  )
}

/** Gruppen-gerahmter Channel-Chat: Breadcrumb zur Gruppe + Channel-Sidebar + Verlauf (Master-Detail). */
export function GruppeChannels() {
  const { id, channelId } = useParams()
  const groupId = Number(id)
  const convId = channelId ? Number(channelId) : null
  const group = useGroup(groupId)
  const canSeeChannels = group.isSuccess && (!!group.data?.my_membership || !!group.data?.can_manage)
  const channels = useGroupChannels(groupId, canSeeChannels)
  const backTo = `/gruppen/${groupId}/channels`

  const groupLink = (
    <Link to={`/gruppen/${groupId}`} className="btn btn-primary btn-sm rounded-full">
      Zur Gruppe
    </Link>
  )

  return (
    <div className="flex flex-col gap-4">
      <Link to={`/gruppen/${groupId}`} className="text-sm font-semibold text-base-content/60 hover:text-base-content">
        ← {group.data?.name ?? 'Zur Gruppe'}
      </Link>

      <Card className="flex h-[72vh] min-h-[500px] overflow-hidden">
        <aside className={cn('flex w-full flex-col border-base-300 md:w-72 md:border-r', convId != null && 'hidden md:flex')}>
          <div className="border-b border-base-300 px-4 py-3.5">
            <h1 className="font-display text-lg">Channels</h1>
            <p className="truncate text-xs text-base-content/50">{group.data?.name}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {group.isLoading || channels.isLoading ? (
              Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="mb-1 h-10 w-full" />)
            ) : !canSeeChannels ? (
              <ChannelsLocked compact />
            ) : (
              <>
                <ChannelList channels={channels.data ?? []} groupId={groupId} activeId={convId ?? undefined} />
                {channels.data && channels.data.length === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-base-content/55">Noch keine Channels.</p>
                )}
              </>
            )}
          </div>
        </aside>

        <main className={cn('min-w-0 flex-1', convId == null && 'hidden md:block')}>
          {group.isLoading ? (
            <div className="grid h-full place-items-center p-8">
              <Skeleton className="h-24 w-3/4" />
            </div>
          ) : !canSeeChannels ? (
            <ChannelsLocked action={groupLink} />
          ) : convId != null ? (
            <ChatThread key={convId} conversationId={convId} backTo={backTo} />
          ) : (
            <ChannelEmpty />
          )}
        </main>
      </Card>
    </div>
  )
}
