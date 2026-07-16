import type { Notification, NotificationType } from '@/api/schemas'
import { usersTable } from './users'

/**
 * Benachrichtigungen des Session-Users (M1-Mock). Vor-gerenderter `text` + `link` → das Center
 * rendert ohne Nachladen. ~50 % ungelesen, damit der Badge sofort sichtbar ist.
 */
type NotificationRecord = {
  id: number
  type: NotificationType
  actor_id: number | null
  text: string
  link: string | null
  read_at: string | null
  created_at: string
}

const notifications: NotificationRecord[] = [
  { id: 1, type: 'new_message', actor_id: 2, text: 'Neue Nachricht von Markus Thaler.', link: '/chat/1', read_at: null, created_at: '2026-06-26T07:41:00+02:00' },
  { id: 2, type: 'group_join_request', actor_id: 6, text: 'Tobias Frank möchte dem „Gleitschirmclub Rhön" beitreten.', link: '/gruppen/2/einstellungen', read_at: null, created_at: '2026-06-26T07:30:00+02:00' },
  { id: 3, type: 'meetup_join', actor_id: 4, text: 'Jonas Weber nimmt an „Abendthermik am Tegelberg" teil.', link: '/flugtreffen/1', read_at: null, created_at: '2026-06-25T19:10:00+02:00' },
  { id: 4, type: 'group_feed_post', actor_id: 3, text: 'Neuer Beitrag in „Allgäu Thermikjäger".', link: '/gruppen/1', read_at: null, created_at: '2026-06-25T18:30:00+02:00' },
  { id: 5, type: 'message_reaction', actor_id: 3, text: 'Sophie Berg hat auf deine Nachricht reagiert.', link: '/chat/4', read_at: '2026-06-25T09:00:00+02:00', created_at: '2026-06-24T20:00:00+02:00' },
  { id: 6, type: 'group_request_approved', actor_id: 5, text: 'Dein Beitritt zu „Hike & Fly Tirol" wurde bestätigt.', link: '/gruppen/3', read_at: '2026-06-24T12:00:00+02:00', created_at: '2026-06-23T15:00:00+02:00' },
  { id: 7, type: 'group_invite', actor_id: 6, text: 'Du wurdest zu „Eifel Einsteiger" eingeladen.', link: '/gruppen/5', read_at: '2026-06-22T10:00:00+02:00', created_at: '2026-06-21T11:00:00+02:00' },
  { id: 8, type: 'meetup_cancelled', actor_id: 7, text: '„Gleitschirm-Treffen Hochfelln" wurde abgesagt.', link: '/flugtreffen/7', read_at: '2026-06-20T08:00:00+02:00', created_at: '2026-06-19T16:00:00+02:00' },
]

function toNotification(r: NotificationRecord): Notification {
  return {
    id: r.id,
    type: r.type,
    actor: r.actor_id != null ? (usersTable.byId(r.actor_id) ?? null) : null,
    text: r.text,
    link: r.link,
    read_at: r.read_at,
    created_at: r.created_at,
  }
}

export const notificationsTable = {
  list: (): Notification[] =>
    [...notifications].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(toNotification),

  unreadCount: (): number => notifications.filter((n) => n.read_at == null).length,

  markRead: (id: number): Notification[] => {
    const n = notifications.find((x) => x.id === id)
    if (n && n.read_at == null) n.read_at = new Date().toISOString()
    return notificationsTable.list()
  },

  markAllRead: (): Notification[] => {
    const now = new Date().toISOString()
    notifications.forEach((n) => {
      if (n.read_at == null) n.read_at = now
    })
    return notificationsTable.list()
  },
}
