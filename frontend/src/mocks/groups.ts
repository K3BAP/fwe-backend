import { ApiError } from '@/api/http'
import type {
  FeedPost,
  GroupCreateInput,
  GroupDetail,
  GroupInvite,
  GroupListItem,
  GroupMember,
  GroupRole,
  JoinRequest,
} from '@/api/schemas'
import { chatTable } from './chat'
import { sessionMock } from './session'
import { usersTable } from './users'

/**
 * Veränderlicher In-Memory-Datensatz der Gruppen (M1-Mock). Gespeichert wird ein Record je Gruppe
 * (Mitglieder/Feed/Anträge/Einladungen); Listen-/Detail-Projektionen + nutzerbezogene Flags werden
 * beim Lesen berechnet. **Channels leben in der Chat-Engine** ([[chat]], ADR-005) und kommen über
 * `chatTable.groupChannels`. In M4/M5 durch echte Endpunkte ersetzt — Hooks/Komponenten bleiben gleich.
 */
type MemberRecord = { user_id: number; role: GroupRole; joined_at: string; status?: 'active' | 'banned' }
type ReactionRecord = { emoji: string; user_ids: number[] }
type FeedRecord = {
  id: number
  author_id: number
  title: string | null
  body: string
  image_path: string | null
  is_pinned: boolean
  created_at: string
  updated_at: string | null
  reactions: ReactionRecord[]
}
type RequestRecord = { id: number; user_id: number; message: string | null; status: 'pending' | 'approved' | 'rejected'; created_at: string }
type InviteRecord = { id: number; invited_user_id: number | null; token: string | null; status: 'pending' | 'accepted' | 'revoked' | 'expired'; max_uses: number | null; uses_count: number }

type GroupRecord = {
  id: number
  slug: string
  name: string
  description: string | null
  logo_path: string | null
  region: string | null
  tags: string[] | null
  visibility: 'public' | 'private' | 'unlisted'
  join_policy: 'open' | 'request' | 'invite_only'
  rules_text: string | null
  owner_id: number
  members: MemberRecord[]
  feed: FeedRecord[]
  requests: RequestRecord[]
  invites: InviteRecord[]
}

const member = (user_id: number, role: GroupRole, joined_at: string): MemberRecord => ({ user_id, role, joined_at })

const groups: GroupRecord[] = [
  {
    id: 1,
    slug: 'allgaeu-thermikjaeger',
    name: 'Allgäu Thermikjäger',
    description: 'Streckenflug & Thermik rund um Tegelberg, Nebelhorn und Buchenberg.',
    logo_path: null,
    region: 'Allgäu',
    tags: ['Streckenflug', 'Thermik'],
    visibility: 'public',
    join_policy: 'open',
    rules_text: 'Respektvoller Umgang, Sicherheit geht vor. Wetterabsagen rechtzeitig posten.',
    owner_id: 2,
    members: [
      member(2, 'owner', '2025-03-12'),
      member(3, 'admin', '2025-04-01'),
      member(1, 'member', '2025-06-20'),
      member(4, 'member', '2025-07-15'),
      member(5, 'member', '2025-09-02'),
      member(6, 'member', '2026-01-10'),
      member(7, 'member', '2026-02-18'),
      member(8, 'member', '2026-05-30'),
    ],
    feed: [
      {
        id: 1,
        author_id: 2,
        title: 'Saisonstart 2026 🪂',
        body: 'Die Thermik-Saison ist eröffnet! Bitte tragt eure geplanten Flugtage im Channel „Wetter & Bedingungen" ein, damit wir Fahrgemeinschaften organisieren können.',
        image_path: null,
        is_pinned: true,
        created_at: '2026-06-22T09:15:00+02:00',
        updated_at: null,
        reactions: [
          { emoji: '🪂', user_ids: [1, 3, 4, 5, 7] },
          { emoji: '🔥', user_ids: [6, 8] },
        ],
      },
      {
        id: 2,
        author_id: 3,
        title: null,
        body: 'Morgen früh stabile Nordlage am Tegelberg — wer ist dabei? Treffpunkt 8:00 oberer Parkplatz.',
        image_path: null,
        is_pinned: false,
        created_at: '2026-06-25T18:30:00+02:00',
        updated_at: null,
        reactions: [{ emoji: '👍', user_ids: [1, 4, 5] }],
      },
    ],
    requests: [],
    invites: [],
  },
  {
    id: 2,
    slug: 'rhoen-gleitschirm',
    name: 'Gleitschirmclub Rhön',
    description: 'Die Community an der Wasserkuppe — vom Anfängerhang bis zum Soaring.',
    logo_path: null,
    region: 'Rhön',
    tags: ['Verein', 'Soaring'],
    visibility: 'public',
    join_policy: 'request',
    rules_text: 'Mitgliedsantrag mit kurzer Vorstellung. Gastflieger willkommen nach Absprache.',
    owner_id: 1,
    members: [
      member(1, 'owner', '2024-11-05'),
      member(2, 'admin', '2025-01-20'),
      member(3, 'member', '2025-03-30'),
      member(4, 'member', '2025-08-12'),
      member(5, 'member', '2026-02-02'),
      member(9, 'member', '2026-04-18'),
    ],
    feed: [
      {
        id: 1,
        author_id: 1,
        title: 'Vereinsausflug zur Wasserkuppe',
        body: 'Am ersten Juli-Wochenende planen wir den großen Vereinsausflug. Anmeldung im Channel „Orga-intern".',
        image_path: null,
        is_pinned: true,
        created_at: '2026-06-20T11:00:00+02:00',
        updated_at: null,
        reactions: [{ emoji: '❤️', user_ids: [2, 3, 4, 9] }],
      },
    ],
    requests: [
      { id: 1, user_id: 6, message: 'Hallo! Fliege seit 2 Jahren, würde mich gern anschließen.', status: 'pending', created_at: '2026-06-24T14:20:00+02:00' },
      { id: 2, user_id: 7, message: null, status: 'pending', created_at: '2026-06-25T08:05:00+02:00' },
      { id: 3, user_id: 8, message: 'Komme aus der Region und suche Anschluss.', status: 'pending', created_at: '2026-06-26T07:30:00+02:00' },
    ],
    invites: [
      { id: 1, invited_user_id: 10, token: null, status: 'pending', max_uses: null, uses_count: 0 },
      { id: 2, invited_user_id: null, token: 'rhoen-2026-abcd', status: 'pending', max_uses: 10, uses_count: 3 },
    ],
  },
  {
    id: 3,
    slug: 'hike-and-fly-tirol',
    name: 'Hike & Fly Tirol',
    description: 'Aufsteigen, abheben, genießen. Touren im Stubai- und Zillertal.',
    logo_path: null,
    region: 'Tirol',
    tags: ['Hike & Fly', 'Alpin'],
    visibility: 'public',
    join_policy: 'open',
    rules_text: null,
    owner_id: 5,
    members: [
      member(5, 'owner', '2025-05-01'),
      member(6, 'admin', '2025-06-15'),
      member(7, 'member', '2025-10-20'),
      member(8, 'member', '2026-01-05'),
      member(9, 'member', '2026-03-12'),
      member(10, 'member', '2026-06-01'),
    ],
    feed: [
      {
        id: 1,
        author_id: 5,
        title: 'Tourenplanung Sommer',
        body: 'Wir sammeln Vorschläge für anspruchsvolle Hike-&-Fly-Touren. Postet eure Lieblingsrouten!',
        image_path: null,
        is_pinned: true,
        created_at: '2026-06-23T19:40:00+02:00',
        updated_at: null,
        reactions: [{ emoji: '🥾', user_ids: [6, 7, 9] }],
      },
    ],
    requests: [],
    invites: [],
  },
  {
    id: 4,
    slug: 'mosel-soaring',
    name: 'Mosel Soaring Crew',
    description: 'Dynamische Hangflüge am Calmont und entlang der Mosel.',
    logo_path: null,
    region: 'Mosel',
    tags: ['Soaring'],
    visibility: 'unlisted',
    join_policy: 'request',
    rules_text: 'Nur per Link auffindbar. Antrag mit Erfahrungsangabe.',
    owner_id: 4,
    members: [
      member(4, 'owner', '2025-07-08'),
      member(2, 'member', '2025-09-19'),
      member(3, 'member', '2026-02-28'),
      member(8, 'member', '2026-05-15'),
    ],
    feed: [],
    requests: [],
    invites: [],
  },
  {
    id: 5,
    slug: 'eifel-anfaenger',
    name: 'Eifel Einsteiger',
    description: 'Geschützter Raum für frische A-Scheine und Übungshang-Sessions.',
    logo_path: null,
    region: 'Eifel',
    tags: ['Anfänger', 'Übungshang'],
    visibility: 'private',
    join_policy: 'invite_only',
    rules_text: 'Privater Kreis. Beitritt nur auf Einladung.',
    owner_id: 6,
    members: [
      member(6, 'owner', '2025-02-14'),
      member(1, 'member', '2025-08-01'),
      member(2, 'member', '2026-01-22'),
      member(7, 'member', '2026-04-09'),
    ],
    feed: [
      {
        id: 1,
        author_id: 6,
        title: 'Willkommen!',
        body: 'Schön, dass ihr da seid. Hier könnt ihr in Ruhe Fragen stellen — keine ist zu einfach. 🙂',
        image_path: null,
        is_pinned: true,
        created_at: '2026-06-18T16:00:00+02:00',
        updated_at: null,
        reactions: [{ emoji: '❤️', user_ids: [1, 2, 7] }],
      },
    ],
    requests: [],
    invites: [{ id: 1, invited_user_id: 9, token: null, status: 'pending', max_uses: null, uses_count: 0 }],
  },
]

let nextGroupId = groups.length + 1
let nextRequestId = 100
let nextInviteId = 100

const meId = () => sessionMock.me()?.id ?? 0

function find(id: number): GroupRecord {
  const g = groups.find((x) => x.id === id)
  if (!g) throw new ApiError('not_found', 'Gruppe nicht gefunden.', 404)
  return g
}

function toListItem(g: GroupRecord): GroupListItem {
  return {
    id: g.id,
    slug: g.slug,
    name: g.name,
    description: g.description,
    logo_path: g.logo_path,
    region: g.region,
    tags: g.tags,
    visibility: g.visibility,
    join_policy: g.join_policy,
    members_count: g.members.length,
  }
}

function myMembership(g: GroupRecord): GroupDetail['my_membership'] {
  const me = g.members.find((m) => m.user_id === meId())
  return me ? { role: me.role, status: 'active' } : null
}

function toDetail(g: GroupRecord): GroupDetail {
  const mem = myMembership(g)
  return {
    ...toListItem(g),
    rules_text: g.rules_text,
    owner_user_id: g.owner_id,
    my_membership: mem,
    can_manage: mem?.role === 'owner' || mem?.role === 'admin',
    has_pending_request: g.requests.some((r) => r.user_id === meId() && r.status === 'pending'),
  }
}

function toFeedPost(g: GroupRecord, f: FeedRecord): FeedPost {
  return {
    id: f.id,
    group_id: g.id,
    author: usersTable.byId(f.author_id) ?? { id: f.author_id, display_name: 'Unbekannt', handle: null, avatar_path: null },
    title: f.title,
    body: f.body,
    image_path: f.image_path,
    is_pinned: f.is_pinned,
    created_at: f.created_at,
    updated_at: f.updated_at,
    reactions: f.reactions.map((r) => ({ emoji: r.emoji, count: r.user_ids.length, me: r.user_ids.includes(meId()) })),
  }
}

export const groupsTable = {
  /** Verzeichnis: public + unlisted, private nur wenn der Session-User Mitglied ist. */
  list: (): GroupListItem[] =>
    groups.filter((g) => g.visibility !== 'private' || g.members.some((m) => m.user_id === meId())).map(toListItem),

  detail: (id: number): GroupDetail => toDetail(find(id)),

  members: (id: number): GroupMember[] =>
    find(id).members.map((m) => ({
      user: usersTable.byId(m.user_id) ?? { id: m.user_id, display_name: 'Unbekannt', handle: null, avatar_path: null },
      role: m.role,
      status: m.status ?? 'active',
      joined_at: m.joined_at,
    })),

  feed: (id: number): FeedPost[] => {
    const g = find(id)
    return [...g.feed].sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.created_at.localeCompare(a.created_at)).map((f) => toFeedPost(g, f))
  },

  /** Feed-Post erstellen (Admin/Owner). */
  createPost: (groupId: number, input: { title: string | null; body: string }): FeedPost => {
    const g = find(groupId)
    const id = g.feed.length ? Math.max(...g.feed.map((f) => f.id)) + 1 : 1
    const rec: FeedRecord = { id, author_id: meId(), title: input.title, body: input.body, image_path: null, is_pinned: false, created_at: new Date().toISOString(), updated_at: null, reactions: [] }
    g.feed.push(rec)
    return toFeedPost(g, rec)
  },

  updatePost: (groupId: number, postId: number, input: { title: string | null; body: string }): FeedPost => {
    const g = find(groupId)
    const f = g.feed.find((x) => x.id === postId)
    if (!f) throw new ApiError('not_found', 'Beitrag nicht gefunden.', 404)
    f.title = input.title
    f.body = input.body
    f.updated_at = new Date().toISOString()
    return toFeedPost(g, f)
  },

  deletePost: (groupId: number, postId: number): void => {
    const g = find(groupId)
    g.feed = g.feed.filter((f) => f.id !== postId)
  },

  /** Beitrag (ent)pinnen. */
  togglePin: (groupId: number, postId: number): FeedPost => {
    const g = find(groupId)
    const f = g.feed.find((x) => x.id === postId)
    if (!f) throw new ApiError('not_found', 'Beitrag nicht gefunden.', 404)
    f.is_pinned = !f.is_pinned
    return toFeedPost(g, f)
  },

  requests: (id: number): JoinRequest[] =>
    find(id)
      .requests.filter((r) => r.status === 'pending')
      .map((r) => ({
        id: r.id,
        user: usersTable.byId(r.user_id) ?? { id: r.user_id, display_name: 'Unbekannt', handle: null, avatar_path: null },
        message: r.message,
        status: r.status,
        created_at: r.created_at,
      })),

  invites: (id: number): GroupInvite[] =>
    find(id)
      .invites.filter((i) => i.status !== 'revoked')
      .map((i) => ({
        id: i.id,
        invited_user: i.invited_user_id ? (usersTable.byId(i.invited_user_id) ?? null) : null,
        token: i.token,
        status: i.status,
        max_uses: i.max_uses,
        uses_count: i.uses_count,
      })),

  /** Direktbeitritt (nur `open`). */
  join: (id: number): GroupDetail => {
    const g = find(id)
    if (g.join_policy !== 'open') throw new ApiError('conflict', 'Diese Gruppe erfordert einen Antrag oder eine Einladung.', 409)
    if (!g.members.some((m) => m.user_id === meId())) g.members.push(member(meId(), 'member', new Date().toISOString().slice(0, 10)))
    return toDetail(g)
  },

  leave: (id: number): GroupDetail => {
    const g = find(id)
    g.members = g.members.filter((m) => m.user_id !== meId())
    return toDetail(g)
  },

  requestJoin: (id: number, message: string | null): GroupDetail => {
    const g = find(id)
    if (!g.requests.some((r) => r.user_id === meId() && r.status === 'pending')) {
      g.requests.push({ id: nextRequestId++, user_id: meId(), message, status: 'pending', created_at: new Date().toISOString() })
    }
    return toDetail(g)
  },

  /** Eigenen offenen Beitrittsantrag zurückziehen. */
  withdrawRequest: (id: number): GroupDetail => {
    const g = find(id)
    g.requests = g.requests.filter((r) => !(r.user_id === meId() && r.status === 'pending'))
    return toDetail(g)
  },

  /** Gerichtete Einladung an einen Nutzer erstellen (Admin). */
  createDirectedInvite: (groupId: number, userId: number): GroupInvite[] => {
    const g = find(groupId)
    if (!g.invites.some((i) => i.invited_user_id === userId && i.status === 'pending')) {
      g.invites.push({ id: nextInviteId++, invited_user_id: userId, token: null, status: 'pending', max_uses: null, uses_count: 0 })
    }
    return groupsTable.invites(groupId)
  },

  reactToPost: (groupId: number, postId: number, emoji: string): FeedPost => {
    const g = find(groupId)
    const post = g.feed.find((f) => f.id === postId)
    if (!post) throw new ApiError('not_found', 'Beitrag nicht gefunden.', 404)
    const reaction = post.reactions.find((r) => r.emoji === emoji)
    if (!reaction) {
      post.reactions.push({ emoji, user_ids: [meId()] })
    } else if (reaction.user_ids.includes(meId())) {
      reaction.user_ids = reaction.user_ids.filter((u) => u !== meId())
      if (reaction.user_ids.length === 0) post.reactions = post.reactions.filter((r) => r.emoji !== emoji)
    } else {
      reaction.user_ids.push(meId())
    }
    return toFeedPost(g, post)
  },

  approveRequest: (groupId: number, requestId: number): JoinRequest[] => {
    const g = find(groupId)
    const req = g.requests.find((r) => r.id === requestId)
    if (req) {
      req.status = 'approved'
      if (!g.members.some((m) => m.user_id === req.user_id)) g.members.push(member(req.user_id, 'member', new Date().toISOString().slice(0, 10)))
    }
    return groupsTable.requests(groupId)
  },

  rejectRequest: (groupId: number, requestId: number): JoinRequest[] => {
    const req = find(groupId).requests.find((r) => r.id === requestId)
    if (req) req.status = 'rejected'
    return groupsTable.requests(groupId)
  },

  createInvite: (groupId: number): GroupInvite[] => {
    const g = find(groupId)
    g.invites.push({ id: nextInviteId, token: `invite-${g.slug}-${nextInviteId}`, invited_user_id: null, status: 'pending', max_uses: null, uses_count: 0 })
    nextInviteId++
    return groupsTable.invites(groupId)
  },

  revokeInvite: (groupId: number, inviteId: number): GroupInvite[] => {
    const inv = find(groupId).invites.find((i) => i.id === inviteId)
    if (inv) inv.status = 'revoked'
    return groupsTable.invites(groupId)
  },

  create: (input: GroupCreateInput): GroupDetail => {
    const slug = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const g: GroupRecord = {
      id: nextGroupId++,
      slug,
      name: input.name,
      description: input.description,
      logo_path: null,
      region: input.region,
      tags: input.tags,
      visibility: input.visibility,
      join_policy: input.join_policy,
      rules_text: input.rules_text,
      owner_id: meId(),
      members: [member(meId(), 'owner', new Date().toISOString().slice(0, 10))],
        feed: [],
      requests: [],
      invites: [],
    }
    groups.unshift(g)
    chatTable.createGroupChannel(g.id, 'Allgemein', g.name, true, 0)
    return toDetail(g)
  },

  /** Metadaten bearbeiten (Owner/Admin). */
  update: (id: number, input: GroupCreateInput): GroupDetail => {
    const g = find(id)
    g.name = input.name
    g.description = input.description
    g.region = input.region
    g.tags = input.tags
    g.rules_text = input.rules_text
    g.visibility = input.visibility
    g.join_policy = input.join_policy
    return toDetail(g)
  },

  /** Gruppe soft-löschen (aus dem Verzeichnis entfernt). */
  softDelete: (id: number): void => {
    const i = groups.findIndex((g) => g.id === id)
    if (i >= 0) groups.splice(i, 1)
  },

  /** Mitglied-Rolle ändern (nicht für Owner). */
  setMemberRole: (groupId: number, userId: number, role: GroupRole): GroupMember[] => {
    const g = find(groupId)
    const m = g.members.find((x) => x.user_id === userId)
    if (m && m.role !== 'owner') m.role = role
    return groupsTable.members(groupId)
  },

  /** Mitglied entfernen (Kick). */
  removeMember: (groupId: number, userId: number): GroupMember[] => {
    const g = find(groupId)
    g.members = g.members.filter((m) => m.user_id !== userId)
    return groupsTable.members(groupId)
  },

  /** Mitglied (ent)bannen. */
  toggleBan: (groupId: number, userId: number): GroupMember[] => {
    const g = find(groupId)
    const m = g.members.find((x) => x.user_id === userId)
    if (m && m.role !== 'owner') m.status = m.status === 'banned' ? 'active' : 'banned'
    return groupsTable.members(groupId)
  },

  /** Owner-Rolle übertragen (alter Owner → Admin). */
  transferOwnership: (groupId: number, userId: number): GroupMember[] => {
    const g = find(groupId)
    const target = g.members.find((x) => x.user_id === userId)
    const current = g.members.find((x) => x.user_id === g.owner_id)
    if (target) {
      if (current) current.role = 'admin'
      target.role = 'owner'
      g.owner_id = userId
    }
    return groupsTable.members(groupId)
  },

  /** Eindeutige Regionen (alphabetisch) für den Verzeichnis-Filter. */
  regions: (): string[] =>
    [...new Set(groups.map((g) => g.region).filter((r): r is string => Boolean(r)))].sort((a, b) => a.localeCompare(b, 'de')),
}
