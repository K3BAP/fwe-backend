import { Link } from 'react-router-dom'
import type { ConversationListItem as Conversation } from '@/api/schemas'
import { cn } from '@/lib/cn'
import { formatRelativeTime } from '@/lib/format'
import { ConversationAvatar } from './ConversationAvatar'

/** Eine Zeile der Konversationsliste (Sidebar). */
export function ConversationListItem({ conversation: c, active }: { conversation: Conversation; active: boolean }) {
  return (
    <Link
      to={`/chat/${c.id}`}
      className={cn('flex items-center gap-3 rounded-2xl px-3 py-2.5 transition', active ? 'bg-primary/10' : 'hover:bg-base-200')}
    >
      <ConversationAvatar type={c.type} peer={c.peer} title={c.title} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={cn('truncate font-semibold', active && 'text-primary')}>{c.title}</span>
          {c.last_message_at && (
            <span className="shrink-0 text-xs text-base-content/45">{formatRelativeTime(c.last_message_at)}</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-sm text-base-content/55">
            {c.last_message ? (c.last_message.body ?? 'Nachricht gelöscht') : 'Noch keine Nachrichten'}
          </span>
          {c.unread_count > 0 && (
            <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-coral-500 px-1.5 text-[11px] font-bold text-white">
              {c.unread_count}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
