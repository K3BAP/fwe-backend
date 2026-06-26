import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui'
import type { Notification } from '@/api/schemas'
import { cn } from '@/lib/cn'
import { formatRelativeTime } from '@/lib/format'
import { BellIcon } from '@/components/layout/icons'

/** Eine Zeile im Notification-Center. Klick markiert als gelesen und navigiert (falls Link). */
export function NotificationItem({ notification: n, onRead }: { notification: Notification; onRead: () => void }) {
  const unread = n.read_at == null

  const inner = (
    <div className={cn('flex items-center gap-3 rounded-2xl px-3 py-3 transition', unread ? 'bg-primary/10' : 'hover:bg-base-200')}>
      {n.actor ? (
        <Avatar name={n.actor.display_name} src={n.actor.avatar_path} size={42} />
      ) : (
        <span className="grid size-[42px] shrink-0 place-items-center rounded-full bg-base-200 text-primary">
          <BellIcon size={20} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">{n.text}</p>
        <div className="mt-0.5 text-xs text-base-content/50">{formatRelativeTime(n.created_at)}</div>
      </div>
      {unread && <span className="size-2.5 shrink-0 rounded-full bg-coral-500" aria-label="ungelesen" />}
    </div>
  )

  if (n.link) {
    return (
      <Link to={n.link} onClick={onRead}>
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onRead} className="block w-full text-left">
      {inner}
    </button>
  )
}
