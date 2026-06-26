import { Link } from 'react-router-dom'
import type { GroupChannel } from '@/api/schemas'
import { cn } from '@/lib/cn'

/** Channel-Liste einer Gruppe → gruppen-gerahmter Channel-Chat unter /gruppen/:id/channels/:convId. */
export function ChannelList({
  channels,
  groupId,
  activeId,
}: {
  channels: GroupChannel[]
  groupId: number
  activeId?: number
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {channels.map((c) => {
        const active = c.conversation_id === activeId
        return (
          <Link
            key={c.conversation_id}
            to={`/gruppen/${groupId}/channels/${c.conversation_id}`}
            className={cn(
              'flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 transition',
              active ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-base-200',
            )}
          >
            <span className="truncate font-medium">
              <span className="text-base-content/40">#</span> {c.name}
            </span>
            {c.unread_count > 0 ? (
              <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-coral-500 px-1.5 text-[11px] font-bold text-white">
                {c.unread_count}
              </span>
            ) : c.is_default ? (
              <span className="shrink-0 text-xs text-base-content/45">Standard</span>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}
