import type { ReactNode } from 'react'
import { GroupIcon } from '@/components/layout/icons'
import { cn } from '@/lib/cn'

/**
 * Hinweis für Nicht-Mitglieder: Channels sind erst nach dem Beitritt sichtbar. `compact` für die
 * schmale Sidebar/Aside, sonst füllt der Hinweis den Bereich (z. B. Channel-Hauptpanel).
 */
export function ChannelsLocked({
  compact = false,
  action,
  className,
}: {
  compact?: boolean
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 text-center',
        compact ? 'px-3 py-6' : 'h-full justify-center p-8',
        className,
      )}
    >
      <span
        className={cn(
          'grid shrink-0 place-items-center rounded-full bg-base-200 text-primary',
          compact ? 'size-11' : 'size-14',
        )}
      >
        <GroupIcon size={compact ? 22 : 26} />
      </span>
      <div>
        <p className={cn('font-display', compact ? 'text-base' : 'text-lg')}>Tritt der Gruppe bei</p>
        <p className="mt-1 max-w-xs text-sm text-base-content/55">
          Channels sind nur für Mitglieder dieser Gruppe sichtbar.
        </p>
      </div>
      {action}
    </div>
  )
}
