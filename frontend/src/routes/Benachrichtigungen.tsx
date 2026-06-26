import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/api/notifications'
import { NotificationItem } from '@/components/notifications/NotificationItem'
import { Button, Card, EmptyState, Skeleton } from '@/components/ui'
import { BellIcon } from '@/components/layout/icons'

/** Benachrichtigungs-Center: Liste (ungelesen oben hervorgehoben), einzeln/alle als gelesen. */
export function Benachrichtigungen() {
  const { data, isLoading, isError } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const hasUnread = (data ?? []).some((n) => n.read_at == null)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl">Benachrichtigungen</h1>
          <p className="mt-1 text-base-content/60">Was in deiner Szene passiert.</p>
        </div>
        {hasUnread && (
          <Button size="sm" variant="outline" disabled={markAll.isPending} onClick={() => markAll.mutate()}>
            Alle als gelesen
          </Button>
        )}
      </div>

      {isError && <p className="rounded-box bg-error/10 px-4 py-3 text-sm text-error">Konnte nicht geladen werden.</p>}

      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      )}

      {!isLoading && !isError && data && data.length === 0 && (
        <EmptyState icon={<BellIcon size={26} />} title="Keine Benachrichtigungen" description="Hier ist gerade alles ruhig." />
      )}

      {!isLoading && data && data.length > 0 && (
        <Card className="flex flex-col gap-0.5 p-2">
          {data.map((n) => (
            <NotificationItem key={n.id} notification={n} onRead={() => n.read_at == null && markRead.mutate(n.id)} />
          ))}
        </Card>
      )}
    </div>
  )
}
