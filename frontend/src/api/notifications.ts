import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { USE_MOCKS } from '@/config'
import { notificationsTable } from '@/mocks/notifications'
import { mockRead, mockWrite } from '@/mocks/runtime'
import { apiFetch } from './http'
import { qk } from './queryKeys'
import { notificationListSchema, type Notification } from './schemas'

/**
 * Benachrichtigungs-Naht (ADR-016): in M1 aus dem Mock-Store, ab M5 auf echte Endpunkte + Polling.
 */
async function fetchNotifications(): Promise<Notification[]> {
  if (USE_MOCKS.notifications) return mockRead(() => notificationsTable.list(), { emptyValue: [] })
  return apiFetch('/notifications', notificationListSchema)
}

export function useNotifications() {
  return useQuery({ queryKey: qk.notifications.list, queryFn: fetchNotifications })
}

export function useNotificationUnread() {
  return useQuery({
    queryKey: qk.notifications.unread,
    queryFn: async () => (USE_MOCKS.notifications ? mockRead(() => notificationsTable.unreadCount()) : apiFetch('/notifications/unread-count', z.number())),
  })
}

/** Teilt das onSuccess (Liste cachen + Unread-Zähler auffrischen) der Read-Mutationen. */
function useNotificationWrite<V>(fn: (vars: V) => Promise<Notification[]>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (list) => {
      qc.setQueryData(qk.notifications.list, list)
      qc.invalidateQueries({ queryKey: qk.notifications.unread })
    },
  })
}

export function useMarkNotificationRead() {
  return useNotificationWrite((id: number) =>
    USE_MOCKS.notifications ? mockWrite(() => notificationsTable.markRead(id)) : apiFetch(`/notifications/${id}/read`, notificationListSchema, { method: 'POST' }),
  )
}

export function useMarkAllNotificationsRead() {
  return useNotificationWrite<void>(() =>
    USE_MOCKS.notifications ? mockWrite(() => notificationsTable.markAllRead()) : apiFetch('/notifications/read-all', notificationListSchema, { method: 'POST' }),
  )
}
