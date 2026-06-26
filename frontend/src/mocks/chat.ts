import { ApiError } from '@/api/http'
import type {
  ConversationDetail,
  ConversationListItem,
  ConversationType,
  GroupChannel,
  Message,
} from '@/api/schemas'
import { sessionMock } from './session'
import { usersTable } from './users'

/**
 * Veränderlicher In-Memory-Datensatz des Chats (M1-Mock). **Eine** polymorphe Engine (ADR-005) für
 * Gruppen-Channels / Treffen-Chats / DMs: ein Gruppen-Channel ist eine `conversation` mit
 * `type='group_channel'`, `context_type='group'`, `context_id=group.id` (DATA_MODEL §5.3/§7). Kein
 * Polling in M1 (statischer Verlauf); in M5 durch echte Endpunkte + gestaffeltes Polling ersetzt.
 */
type ReactionRecord = { emoji: string; user_ids: number[] }
type MessageRecord = {
  id: number
  sender_id: number
  body: string | null
  reply_to_id: number | null
  created_at: string
  edited_at: string | null
  deleted_at: string | null
  reactions: ReactionRecord[]
}
type ConversationRecord = {
  id: number
  type: ConversationType
  title: string
  /** Kurzer Channel-Name (nur group_channel), z.B. „Allgemein" — vs. `title` „Gruppe · Channel". */
  channel_name: string | null
  context_type: 'group' | 'meetup' | null
  context_id: number | null
  is_default: boolean
  position: number
  peer_id: number | null
  participant_ids: number[]
  creator_user_id: number | null
  unread: number
  messages: MessageRecord[]
}

const ME = 1 // Session-User (Lena)

/** Knapper Message-Builder. */
function msg(id: number, sender_id: number, body: string | null, created_at: string, extra: Partial<MessageRecord> = {}): MessageRecord {
  return { id, sender_id, body, created_at, reply_to_id: null, edited_at: null, deleted_at: null, reactions: [], ...extra }
}

/** Defaults für Nicht-Channel-Konversationen (DM/Treffen). */
const base = { channel_name: null, is_default: false, position: 0 }

const conversations: ConversationRecord[] = [
  {
    id: 1,
    type: 'direct',
    title: 'Markus Thaler',
    ...base,
    context_type: null,
    context_id: null,
    peer_id: 2,
    participant_ids: [1, 2],
    creator_user_id: null,
    unread: 2,
    messages: [
      msg(1, 2, 'Servus Lena! Fliegst du morgen am Tegelberg mit?', '2026-06-25T18:12:00+02:00'),
      msg(2, 1, 'Klar, bin dabei! Wann triffst du dich am Parkplatz?', '2026-06-25T18:20:00+02:00'),
      msg(3, 2, 'So gegen 8. Nehme noch zwei aus der Gruppe mit.', '2026-06-25T18:22:00+02:00', { reactions: [{ emoji: '👍', user_ids: [1] }] }),
      msg(4, 2, 'Wetter sieht übrigens top aus — stabile Nordlage.', '2026-06-26T07:40:00+02:00'),
      msg(5, 2, 'Bring am besten genug Wasser mit, wird warm. ☀️', '2026-06-26T07:41:00+02:00'),
    ],
  },
  {
    id: 2,
    type: 'group_channel',
    title: 'Allgäu Thermikjäger · Allgemein',
    channel_name: 'Allgemein',
    context_type: 'group',
    context_id: 1,
    is_default: true,
    position: 0,
    peer_id: null,
    participant_ids: [1, 2, 3, 4, 5, 6, 7, 8],
    creator_user_id: null,
    unread: 5,
    messages: [
      msg(1, 3, 'Moin zusammen! Jemand am Wochenende am Nebelhorn?', '2026-06-24T09:00:00+02:00'),
      msg(2, 4, 'Ich evtl. Samstag, je nach Wind.', '2026-06-24T09:15:00+02:00'),
      msg(3, 5, 'Schaut euch mal die Prognose an: https://www.dwd.de', '2026-06-24T09:30:00+02:00'),
      msg(4, 2, 'Danke! Sieht gut aus für Samstagvormittag.', '2026-06-24T10:05:00+02:00', { reply_to_id: 3, reactions: [{ emoji: '🔥', user_ids: [3, 4] }] }),
      msg(5, 6, 'Bin raus, muss arbeiten 😅', '2026-06-24T11:00:00+02:00'),
      msg(6, 7, 'Nächstes Mal! Viel Spaß euch.', '2026-06-24T11:10:00+02:00'),
      msg(7, 8, null, '2026-06-24T12:00:00+02:00', { deleted_at: '2026-06-24T12:01:00+02:00' }),
      msg(8, 3, 'Treffpunkt dann Samstag 9 Uhr Talstation?', '2026-06-26T08:15:00+02:00'),
      msg(9, 4, 'Passt für mich 👍', '2026-06-26T08:20:00+02:00'),
    ],
  },
  {
    id: 3,
    type: 'meetup',
    title: 'Abendthermik am Tegelberg',
    ...base,
    context_type: 'meetup',
    context_id: 1,
    peer_id: null,
    participant_ids: [1, 2, 4, 5, 6, 7, 8, 3],
    creator_user_id: 1,
    unread: 0,
    messages: [
      msg(1, 1, 'Hallo zusammen! Ich habe das Treffen erstellt — freue mich auf euch. 🪂', '2026-06-23T20:00:00+02:00', { reactions: [{ emoji: '🪂', user_ids: [2, 4, 5, 6] }] }),
      msg(2, 4, 'Super, danke fürs Organisieren!', '2026-06-23T20:05:00+02:00'),
      msg(3, 5, 'Wo genau treffen wir uns?', '2026-06-23T20:10:00+02:00'),
      msg(4, 1, 'Treffpunkt 17:00 am oberen Parkplatz. Bitte Schirm-Check machen.', '2026-06-23T20:12:00+02:00', { reply_to_id: 3 }),
      msg(5, 6, 'Alles klar, bin pünktlich da.', '2026-06-24T18:30:00+02:00'),
      msg(6, 1, 'Kurze Info: Wetter passt, wir starten wie geplant.', '2026-06-26T09:00:00+02:00', { edited_at: '2026-06-26T09:02:00+02:00' }),
    ],
  },
  {
    id: 4,
    type: 'direct',
    title: 'Sophie Berg',
    ...base,
    context_type: null,
    context_id: null,
    peer_id: 3,
    participant_ids: [1, 3],
    creator_user_id: null,
    unread: 0,
    messages: [
      msg(1, 3, 'Hey, hast du noch den Kontakt vom Fluglehrer aus Tirol?', '2026-06-22T14:00:00+02:00'),
      msg(2, 1, 'Ja klar, schicke ich dir gleich rüber.', '2026-06-22T14:10:00+02:00'),
      msg(3, 3, 'Mega, danke dir! ❤️', '2026-06-22T14:12:00+02:00', { reactions: [{ emoji: '❤️', user_ids: [1] }] }),
    ],
  },
  {
    id: 5,
    type: 'group_channel',
    title: 'Gleitschirmclub Rhön · Allgemein',
    channel_name: 'Allgemein',
    context_type: 'group',
    context_id: 2,
    is_default: true,
    position: 0,
    peer_id: null,
    participant_ids: [1, 2, 3, 4, 5, 9],
    creator_user_id: null,
    unread: 0,
    messages: [
      msg(1, 2, 'Erinnerung: Vereinsausflug am ersten Juli-Wochenende!', '2026-06-20T11:30:00+02:00', { reactions: [{ emoji: '🎉', user_ids: [1, 3, 4, 9] }] }),
      msg(2, 9, 'Freue mich drauf 🙌', '2026-06-20T12:00:00+02:00'),
      msg(3, 1, 'Ich kümmere mich um die Fahrgemeinschaften.', '2026-06-21T09:00:00+02:00'),
    ],
  },
  // ── Weitere Gruppen-Channels (nur über die Gruppendetailseite erreichbar) ──
  {
    id: 6,
    type: 'group_channel',
    title: 'Allgäu Thermikjäger · Wetter & Bedingungen',
    channel_name: 'Wetter & Bedingungen',
    context_type: 'group',
    context_id: 1,
    is_default: false,
    position: 1,
    peer_id: null,
    participant_ids: [2, 3, 4, 5, 6, 7, 8],
    creator_user_id: null,
    unread: 0,
    messages: [
      msg(1, 5, 'Tendenz fürs Wochenende: Nordwest, mäßig. Eher vormittags fliegbar.', '2026-06-25T20:00:00+02:00'),
      msg(2, 3, 'Danke fürs Update! 🙏', '2026-06-25T20:14:00+02:00', { reactions: [{ emoji: '👍', user_ids: [4, 6] }] }),
    ],
  },
  {
    id: 7,
    type: 'group_channel',
    title: 'Allgäu Thermikjäger · Streckenmeldungen',
    channel_name: 'Streckenmeldungen',
    context_type: 'group',
    context_id: 1,
    is_default: false,
    position: 2,
    peer_id: null,
    participant_ids: [2, 3, 5, 8],
    creator_user_id: null,
    unread: 0,
    messages: [
      msg(1, 8, '84 km vom Tegelberg Richtung Karwendel — bester Flug der Saison! 🚀', '2026-06-22T17:30:00+02:00', { reactions: [{ emoji: '🔥', user_ids: [2, 3, 5] }] }),
    ],
  },
  {
    id: 8,
    type: 'group_channel',
    title: 'Gleitschirmclub Rhön · Orga-intern',
    channel_name: 'Orga-intern',
    context_type: 'group',
    context_id: 2,
    is_default: false,
    position: 1,
    peer_id: null,
    participant_ids: [2, 4],
    creator_user_id: null,
    unread: 0,
    messages: [msg(1, 2, 'Bitte Anmeldungen für den Ausflug bis Freitag hier eintragen.', '2026-06-21T10:00:00+02:00')],
  },
  {
    id: 9,
    type: 'group_channel',
    title: 'Hike & Fly Tirol · Allgemein',
    channel_name: 'Allgemein',
    context_type: 'group',
    context_id: 3,
    is_default: true,
    position: 0,
    peer_id: null,
    participant_ids: [5, 6, 7, 8, 9, 10],
    creator_user_id: null,
    unread: 0,
    messages: [
      msg(1, 5, 'Sammelthread für Tourenvorschläge — postet eure Lieblingsrouten!', '2026-06-23T19:45:00+02:00'),
      msg(2, 9, 'Stubai-Höhenweg + Abflug vom Kreuzjoch ist top.', '2026-06-23T20:02:00+02:00', { reactions: [{ emoji: '🥾', user_ids: [6, 7] }] }),
    ],
  },
  {
    id: 10,
    type: 'group_channel',
    title: 'Mosel Soaring Crew · Allgemein',
    channel_name: 'Allgemein',
    context_type: 'group',
    context_id: 4,
    is_default: true,
    position: 0,
    peer_id: null,
    participant_ids: [4, 2, 3, 8],
    creator_user_id: null,
    unread: 0,
    messages: [msg(1, 4, 'Calmont heute Nachmittag Soaring-Bedingungen — wer kommt?', '2026-06-24T13:00:00+02:00')],
  },
  {
    id: 11,
    type: 'group_channel',
    title: 'Eifel Einsteiger · Allgemein',
    channel_name: 'Allgemein',
    context_type: 'group',
    context_id: 5,
    is_default: true,
    position: 0,
    peer_id: null,
    participant_ids: [6, 1, 2, 7],
    creator_user_id: null,
    unread: 0,
    messages: [
      msg(1, 6, 'Willkommen! Stellt hier gern eure Fragen — keine ist zu einfach. 🙂', '2026-06-18T16:05:00+02:00', { reactions: [{ emoji: '❤️', user_ids: [1, 7] }] }),
    ],
  },
]

let nextConvId = conversations.length + 1
const nextMsgId = (c: ConversationRecord) => (c.messages.length ? Math.max(...c.messages.map((m) => m.id)) + 1 : 1)
const meId = () => sessionMock.me()?.id ?? ME

function find(id: number): ConversationRecord {
  const c = conversations.find((x) => x.id === id)
  if (!c) throw new ApiError('not_found', 'Konversation nicht gefunden.', 404)
  return c
}

const userName = (id: number) => usersTable.byId(id)?.display_name ?? 'Unbekannt'
const userCard = (id: number) => usersTable.byId(id) ?? { id, display_name: 'Unbekannt', handle: null, avatar_path: null }

function toListItem(c: ConversationRecord): ConversationListItem {
  const last = c.messages[c.messages.length - 1] ?? null
  return {
    id: c.id,
    type: c.type,
    title: c.title,
    peer: c.peer_id != null ? userCard(c.peer_id) : null,
    last_message: last
      ? { body: last.deleted_at ? null : last.body, sender_name: userName(last.sender_id), created_at: last.created_at }
      : null,
    unread_count: c.unread,
    last_message_at: last?.created_at ?? null,
  }
}

function toMessage(c: ConversationRecord, m: MessageRecord): Message {
  const replySrc = m.reply_to_id != null ? c.messages.find((x) => x.id === m.reply_to_id) : null
  return {
    id: m.id,
    conversation_id: c.id,
    sender: userCard(m.sender_id),
    body: m.deleted_at ? null : m.body,
    reply_to: replySrc ? { id: replySrc.id, sender_name: userName(replySrc.sender_id), body: replySrc.deleted_at ? null : replySrc.body } : null,
    is_creator: c.type === 'meetup' && c.creator_user_id === m.sender_id,
    created_at: m.created_at,
    edited_at: m.edited_at,
    deleted_at: m.deleted_at,
    reactions: m.reactions.map((r) => ({ emoji: r.emoji, count: r.user_ids.length, me: r.user_ids.includes(meId()) })),
  }
}

export const chatTable = {
  /** Globale Konversationsliste: nur Konversationen, an denen der Session-User teilnimmt. */
  list: (): ConversationListItem[] =>
    conversations
      .filter((c) => c.participant_ids.includes(meId()))
      .sort((a, b) => (b.messages.at(-1)?.created_at ?? '').localeCompare(a.messages.at(-1)?.created_at ?? ''))
      .map(toListItem),

  detail: (id: number): ConversationDetail => {
    const c = find(id)
    return {
      id: c.id,
      type: c.type,
      title: c.title,
      peer: c.peer_id != null ? userCard(c.peer_id) : null,
      participants: usersTable.resolve(c.participant_ids),
      creator_user_id: c.creator_user_id,
    }
  },

  messages: (id: number): Message[] => {
    const c = find(id)
    return c.messages.map((m) => toMessage(c, m))
  },

  send: (id: number, body: string, replyToId: number | null): Message => {
    const c = find(id)
    const m = msg(nextMsgId(c), meId(), body, new Date().toISOString(), { reply_to_id: replyToId })
    c.messages.push(m)
    c.unread = 0
    return toMessage(c, m)
  },

  react: (id: number, messageId: number, emoji: string): Message => {
    const c = find(id)
    const m = c.messages.find((x) => x.id === messageId)
    if (!m) throw new ApiError('not_found', 'Nachricht nicht gefunden.', 404)
    const r = m.reactions.find((x) => x.emoji === emoji)
    if (!r) m.reactions.push({ emoji, user_ids: [meId()] })
    else if (r.user_ids.includes(meId())) {
      r.user_ids = r.user_ids.filter((u) => u !== meId())
      if (r.user_ids.length === 0) m.reactions = m.reactions.filter((x) => x.emoji !== emoji)
    } else r.user_ids.push(meId())
    return toMessage(c, m)
  },

  markRead: (id: number): void => {
    find(id).unread = 0
  },

  unreadTotal: (): number => conversations.filter((c) => c.participant_ids.includes(meId())).reduce((sum, c) => sum + c.unread, 0),

  /** Channels einer Gruppe (= `conversations` mit context group, API.md §7.1). */
  groupChannels: (groupId: number): GroupChannel[] =>
    conversations
      .filter((c) => c.type === 'group_channel' && c.context_id === groupId)
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        conversation_id: c.id,
        name: c.channel_name ?? c.title,
        is_default: c.is_default,
        unread_count: c.unread,
      })),

  /** Legt einen Gruppen-Channel an (z.B. „Allgemein" beim Gruppen-Erstellen). Gibt die Conv-ID zurück. */
  createGroupChannel: (groupId: number, channelName: string, groupTitle: string, isDefault: boolean, position: number): number => {
    const c: ConversationRecord = {
      id: nextConvId++,
      type: 'group_channel',
      title: `${groupTitle} · ${channelName}`,
      channel_name: channelName,
      context_type: 'group',
      context_id: groupId,
      is_default: isDefault,
      position,
      peer_id: null,
      participant_ids: [meId()],
      creator_user_id: null,
      unread: 0,
      messages: [],
    }
    conversations.push(c)
    return c.id
  },

  /** DM mit einem Nutzer finden oder anlegen (Profil → „Direktchat öffnen"). */
  findOrCreateDm: (userId: number): number => {
    const existing = conversations.find((c) => c.type === 'direct' && c.peer_id === userId)
    if (existing) return existing.id
    const c: ConversationRecord = {
      id: nextConvId++,
      type: 'direct',
      title: userName(userId),
      ...base,
      context_type: null,
      context_id: null,
      peer_id: userId,
      participant_ids: [meId(), userId],
      creator_user_id: null,
      unread: 0,
      messages: [],
    }
    conversations.unshift(c)
    return c.id
  },
}
