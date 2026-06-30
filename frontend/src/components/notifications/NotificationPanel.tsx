import { useState } from 'react'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/api/notifications'
import { Button, EmptyState, SegmentedControl, Skeleton, Stagger, StaggerItem } from '@/components/ui'
import { BellIcon, CheckIcon } from '@/components/layout/icons'
import { NotificationItem } from './NotificationItem'

type Filter = 'all' | 'unread'

/**
 * Inhalt des Benachrichtigungs-Centers — geteilt von Desktop-Popover und mobilem Bottom-Sheet
 * ({@link NotificationCenter}). Kopf mit „alle gelesen“, Alle/Ungelesen-Filter und scrollender Liste.
 * `onClose` schließt das umgebende Panel beim Klick auf eine Zeile (markiert + navigiert).
 */
export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { data, isLoading, isError } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const [filter, setFilter] = useState<Filter>('all')

  const list = data ?? []
  const unreadCount = list.filter((n) => n.read_at == null).length
  const visible = filter === 'unread' ? list.filter((n) => n.read_at == null) : list

  return (
    <div className="flex min-h-0 flex-col">
      {/* Kopf: Titel + „alle als gelesen“ */}
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <h2 className="font-display text-lg">Benachrichtigungen</h2>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="ghost"
            disabled={markAll.isPending}
            onClick={() => markAll.mutate()}
            className="gap-1.5 whitespace-nowrap px-2.5 text-sm"
          >
            <CheckIcon size={15} />
            Alle gelesen
          </Button>
        )}
      </div>

      {/* Filter */}
      <div className="px-4 pb-3">
        <SegmentedControl<Filter>
          aria-label="Benachrichtigungen filtern"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Alle' },
            { value: 'unread', label: unreadCount > 0 ? `Ungelesen · ${unreadCount}` : 'Ungelesen' },
          ]}
        />
      </div>

      {/* Liste (eigenes Scrolling) */}
      <div className="max-h-[60vh] min-h-0 flex-1 overflow-y-auto border-t border-base-300 p-2">
        {isError && <p className="rounded-box bg-error/10 px-4 py-3 text-sm text-error">Konnte nicht geladen werden.</p>}

        {isLoading && (
          <div className="flex flex-col gap-2 p-1">
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        )}

        {!isLoading && !isError && visible.length === 0 && (
          <EmptyState
            icon={<BellIcon size={24} />}
            title={filter === 'unread' ? 'Alles gelesen' : 'Keine Benachrichtigungen'}
            description={filter === 'unread' ? 'Keine ungelesenen Benachrichtigungen.' : 'Hier ist gerade alles ruhig.'}
            className="border-0 bg-transparent py-10"
          />
        )}

        {!isLoading && visible.length > 0 && (
          <Stagger className="flex flex-col gap-0.5">
            {visible.map((n) => (
              <StaggerItem key={n.id}>
                <NotificationItem
                  notification={n}
                  onRead={() => {
                    if (n.read_at == null) markRead.mutate(n.id)
                    onClose()
                  }}
                />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </div>
  )
}
