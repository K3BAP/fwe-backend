import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { USE_MOCKS } from '@/config'
import { chatTable } from '@/mocks/chat'
import { groupsTable } from '@/mocks/groups'
import { mockRead, mockWrite } from '@/mocks/runtime'
import { toast } from '@/stores/toastStore'
import { ApiError, apiFetch } from './http'
import { qk } from './queryKeys'
import {
  feedPostListSchema,
  feedPostSchema,
  groupChannelListSchema,
  groupDetailSchema,
  groupInviteListSchema,
  groupListSchema,
  groupMemberListSchema,
  joinRequestListSchema,
  type FeedPost,
  type FeedPostCreateInput,
  type GroupChannel,
  type GroupCreateInput,
  type GroupDetail,
  type GroupInvite,
  type GroupListItem,
  type GroupMember,
  type GroupRole,
  type JoinRequest,
} from './schemas'

/**
 * Gruppen-Naht (ADR-016): in M1 aus dem Mock-Store, ab M4 (Gruppen verkabeln) auf `apiFetch` —
 * nur diese Funktionen ändern sich, Hooks/Komponenten bleiben gleich.
 */
async function fetchGroups(): Promise<GroupListItem[]> {
  if (USE_MOCKS) return mockRead(() => groupsTable.list(), { emptyValue: [] })
  return apiFetch('/groups', groupListSchema)
}
async function fetchGroup(id: number): Promise<GroupDetail> {
  if (USE_MOCKS) return mockRead(() => groupsTable.detail(id))
  return apiFetch(`/groups/${id}`, groupDetailSchema)
}
async function fetchMembers(id: number): Promise<GroupMember[]> {
  if (USE_MOCKS) return mockRead(() => groupsTable.members(id), { emptyValue: [] })
  return apiFetch(`/groups/${id}/members`, groupMemberListSchema)
}
async function fetchFeed(id: number): Promise<FeedPost[]> {
  if (USE_MOCKS) return mockRead(() => groupsTable.feed(id), { emptyValue: [] })
  return apiFetch(`/groups/${id}/feed`, feedPostListSchema)
}
async function fetchRequests(id: number): Promise<JoinRequest[]> {
  if (USE_MOCKS) return mockRead(() => groupsTable.requests(id), { emptyValue: [] })
  return apiFetch(`/groups/${id}/join-requests`, joinRequestListSchema)
}
async function fetchInvites(id: number): Promise<GroupInvite[]> {
  if (USE_MOCKS) return mockRead(() => groupsTable.invites(id), { emptyValue: [] })
  return apiFetch(`/groups/${id}/invites`, groupInviteListSchema)
}
async function fetchChannels(id: number): Promise<GroupChannel[]> {
  // Channels sind Konversationen (ADR-005) → aus dem Chat-Store, Endpunkt /groups/:id/channels.
  if (USE_MOCKS) return mockRead(() => chatTable.groupChannels(id), { emptyValue: [] })
  return apiFetch(`/groups/${id}/channels`, groupChannelListSchema)
}

export function useGroups() {
  return useQuery({ queryKey: qk.groups.list(), queryFn: fetchGroups })
}
export function useGroup(id: number) {
  return useQuery({ queryKey: qk.groups.detail(id), queryFn: () => fetchGroup(id), enabled: Number.isFinite(id) })
}
export function useGroupMembers(id: number) {
  return useQuery({ queryKey: qk.groups.members(id), queryFn: () => fetchMembers(id), enabled: Number.isFinite(id) })
}
export function useGroupFeed(id: number) {
  return useQuery({ queryKey: qk.groups.feed(id), queryFn: () => fetchFeed(id), enabled: Number.isFinite(id) })
}
export function useGroupRequests(id: number, enabled = true) {
  return useQuery({ queryKey: qk.groups.requests(id), queryFn: () => fetchRequests(id), enabled: enabled && Number.isFinite(id) })
}
export function useGroupInvites(id: number, enabled = true) {
  return useQuery({ queryKey: qk.groups.invites(id), queryFn: () => fetchInvites(id), enabled: enabled && Number.isFinite(id) })
}
export function useGroupChannels(id: number) {
  return useQuery({ queryKey: qk.groups.channels(id), queryFn: () => fetchChannels(id), enabled: Number.isFinite(id) })
}

/** Beitritt/Verlassen/Antrag: schreibt Detail + frischt Liste/Mitglieder auf. */
function useGroupMembershipMutation(
  fn: (vars: { id: number; message?: string | null }) => Promise<GroupDetail>,
  successMsg: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (detail) => {
      qc.setQueryData(qk.groups.detail(detail.id), detail)
      qc.invalidateQueries({ queryKey: [...qk.groups.all, 'list'] })
      qc.invalidateQueries({ queryKey: qk.groups.members(detail.id) })
      toast.success(successMsg)
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : 'Aktion fehlgeschlagen.'),
  })
}

export function useJoinGroup() {
  return useGroupMembershipMutation(
    ({ id }) => (USE_MOCKS ? mockWrite(() => groupsTable.join(id)) : apiFetch(`/groups/${id}/members`, groupDetailSchema, { method: 'POST' })),
    'Willkommen in der Gruppe! 🪂',
  )
}
export function useLeaveGroup() {
  return useGroupMembershipMutation(
    ({ id }) => (USE_MOCKS ? mockWrite(() => groupsTable.leave(id)) : apiFetch(`/groups/${id}/members`, groupDetailSchema, { method: 'DELETE' })),
    'Gruppe verlassen.',
  )
}
export function useRequestJoin() {
  return useGroupMembershipMutation(
    ({ id, message }) =>
      USE_MOCKS
        ? mockWrite(() => groupsTable.requestJoin(id, message ?? null))
        : apiFetch(`/groups/${id}/join-requests`, groupDetailSchema, { method: 'POST', body: { message } }),
    'Beitrittsantrag gesendet.',
  )
}

/** Emoji-Reaktion auf einen Feed-Post, optimistisch auf dem Feed-Cache. */
export function useReactToPost(groupId: number) {
  const qc = useQueryClient()
  const key = qk.groups.feed(groupId)
  return useMutation({
    mutationFn: ({ postId, emoji }: { postId: number; emoji: string }): Promise<FeedPost> =>
      USE_MOCKS
        ? mockWrite(() => groupsTable.reactToPost(groupId, postId, emoji))
        : apiFetch(`/groups/${groupId}/feed/${postId}/reactions`, feedPostSchema, { method: 'POST', body: { emoji } }),
    onMutate: async ({ postId, emoji }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<FeedPost[]>(key)
      if (prev) qc.setQueryData(key, prev.map((p) => (p.id === postId ? toggleReaction(p, emoji) : p)))
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(key, ctx.prev),
    onSuccess: (post) => qc.setQueryData(key, (old: FeedPost[] | undefined) => old?.map((p) => (p.id === post.id ? post : p))),
  })
}

function toggleReaction(post: FeedPost, emoji: string): FeedPost {
  const existing = post.reactions.find((r) => r.emoji === emoji)
  let reactions
  if (!existing) {
    reactions = [...post.reactions, { emoji, count: 1, me: true }]
  } else if (existing.me) {
    reactions = post.reactions
      .map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, me: false } : r))
      .filter((r) => r.count > 0)
  } else {
    reactions = post.reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, me: true } : r))
  }
  return { ...post, reactions }
}

/** Feed-Post erstellen (Admin/Owner) → Feed neu laden. */
export function useCreateFeedPost(groupId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: FeedPostCreateInput): Promise<FeedPost> =>
      USE_MOCKS ? mockWrite(() => groupsTable.createPost(groupId, input)) : apiFetch(`/groups/${groupId}/feed`, feedPostSchema, { method: 'POST', body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.groups.feed(groupId) })
      toast.success('Beitrag veröffentlicht.')
    },
  })
}

export function useUpdateFeedPost(groupId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, input }: { postId: number; input: FeedPostCreateInput }): Promise<FeedPost> =>
      USE_MOCKS ? mockWrite(() => groupsTable.updatePost(groupId, postId, input)) : apiFetch(`/groups/${groupId}/feed/${postId}`, feedPostSchema, { method: 'PATCH', body: input }),
    onSuccess: (post) => qc.setQueryData<FeedPost[]>(qk.groups.feed(groupId), (old) => old?.map((p) => (p.id === post.id ? post : p))),
  })
}

export function useDeleteFeedPost(groupId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (postId: number): Promise<void> => {
      if (USE_MOCKS) {
        await mockWrite(() => groupsTable.deletePost(groupId, postId))
        return
      }
      await apiFetch(`/groups/${groupId}/feed/${postId}`, feedPostListSchema, { method: 'DELETE' })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.groups.feed(groupId) }),
  })
}

export function useTogglePinPost(groupId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (postId: number): Promise<FeedPost> =>
      USE_MOCKS ? mockWrite(() => groupsTable.togglePin(groupId, postId)) : apiFetch(`/groups/${groupId}/feed/${postId}/pin`, feedPostSchema, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.groups.feed(groupId) }),
  })
}

export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: GroupCreateInput): Promise<GroupDetail> =>
      USE_MOCKS ? mockWrite(() => groupsTable.create(input)) : apiFetch('/groups', groupDetailSchema, { method: 'POST', body: input }),
    onSuccess: (detail) => {
      qc.setQueryData(qk.groups.detail(detail.id), detail)
      qc.invalidateQueries({ queryKey: [...qk.groups.all, 'list'] })
    },
  })
}

export function useUpdateGroup(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: GroupCreateInput): Promise<GroupDetail> =>
      USE_MOCKS ? mockWrite(() => groupsTable.update(id, input)) : apiFetch(`/groups/${id}`, groupDetailSchema, { method: 'PATCH', body: input }),
    onSuccess: (detail) => {
      qc.setQueryData(qk.groups.detail(detail.id), detail)
      qc.invalidateQueries({ queryKey: [...qk.groups.all, 'list'] })
      toast.success('Gruppe gespeichert.')
    },
  })
}

export function useDeleteGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      if (USE_MOCKS) {
        await mockWrite(() => groupsTable.softDelete(id))
        return
      }
      await apiFetch(`/groups/${id}`, groupListSchema, { method: 'DELETE' })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...qk.groups.all, 'list'] }),
  })
}

/** Mitglieder-Verwaltung: aktualisiert Mitglieder + Detail (Owner/Rolle) + Liste (Anzahl). */
function useMemberMutation<V>(groupId: number, fn: (vars: V) => Promise<GroupMember[]>, msg?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (members) => {
      qc.setQueryData(qk.groups.members(groupId), members)
      qc.invalidateQueries({ queryKey: qk.groups.detail(groupId) })
      qc.invalidateQueries({ queryKey: [...qk.groups.all, 'list'] })
      if (msg) toast.success(msg)
    },
  })
}

export function useSetMemberRole(groupId: number) {
  return useMemberMutation<{ userId: number; role: GroupRole }>(
    groupId,
    ({ userId, role }) =>
      USE_MOCKS
        ? mockWrite(() => groupsTable.setMemberRole(groupId, userId, role))
        : apiFetch(`/groups/${groupId}/members/${userId}`, groupMemberListSchema, { method: 'PATCH', body: { role } }),
    'Rolle aktualisiert.',
  )
}

export function useRemoveMember(groupId: number) {
  return useMemberMutation<number>(
    groupId,
    (userId) =>
      USE_MOCKS
        ? mockWrite(() => groupsTable.removeMember(groupId, userId))
        : apiFetch(`/groups/${groupId}/members/${userId}`, groupMemberListSchema, { method: 'DELETE' }),
    'Mitglied entfernt.',
  )
}

export function useToggleBan(groupId: number) {
  return useMemberMutation<number>(
    groupId,
    (userId) =>
      USE_MOCKS
        ? mockWrite(() => groupsTable.toggleBan(groupId, userId))
        : apiFetch(`/groups/${groupId}/members/${userId}/ban`, groupMemberListSchema, { method: 'POST' }),
    'Status aktualisiert.',
  )
}

export function useTransferOwnership(groupId: number) {
  return useMemberMutation<number>(
    groupId,
    (userId) =>
      USE_MOCKS
        ? mockWrite(() => groupsTable.transferOwnership(groupId, userId))
        : apiFetch(`/groups/${groupId}/transfer`, groupMemberListSchema, { method: 'POST', body: { user_id: userId } }),
    'Eigentümerschaft übertragen.',
  )
}

/** Admin: Antrag genehmigen/ablehnen → aktualisiert Anträge + (bei Genehmigung) Mitglieder. */
function useRequestDecision(decide: (groupId: number, requestId: number) => Promise<JoinRequest[]>, approve: boolean) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, requestId }: { groupId: number; requestId: number }) => decide(groupId, requestId),
    onSuccess: (requests, { groupId }) => {
      qc.setQueryData(qk.groups.requests(groupId), requests)
      if (approve) {
        qc.invalidateQueries({ queryKey: qk.groups.members(groupId) })
        qc.invalidateQueries({ queryKey: qk.groups.detail(groupId) })
      }
      toast.success(approve ? 'Antrag genehmigt.' : 'Antrag abgelehnt.')
    },
  })
}
export function useApproveRequest() {
  return useRequestDecision(
    (g, r) => (USE_MOCKS ? mockWrite(() => groupsTable.approveRequest(g, r)) : apiFetch(`/groups/${g}/join-requests/${r}/approve`, joinRequestListSchema, { method: 'POST' })),
    true,
  )
}
export function useRejectRequest() {
  return useRequestDecision(
    (g, r) => (USE_MOCKS ? mockWrite(() => groupsTable.rejectRequest(g, r)) : apiFetch(`/groups/${g}/join-requests/${r}/reject`, joinRequestListSchema, { method: 'POST' })),
    false,
  )
}

/** Admin: Einladungen erstellen/widerrufen. */
function useInviteMutation(fn: (groupId: number, inviteId: number) => Promise<GroupInvite[]>, msg: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, inviteId }: { groupId: number; inviteId?: number }) => fn(groupId, inviteId ?? 0),
    onSuccess: (invites, { groupId }) => {
      qc.setQueryData(qk.groups.invites(groupId), invites)
      toast.success(msg)
    },
  })
}
export function useCreateInvite() {
  return useInviteMutation(
    (g) => (USE_MOCKS ? mockWrite(() => groupsTable.createInvite(g)) : apiFetch(`/groups/${g}/invites`, groupInviteListSchema, { method: 'POST' })),
    'Einladungslink erstellt.',
  )
}
export function useRevokeInvite() {
  return useInviteMutation(
    (g, i) => (USE_MOCKS ? mockWrite(() => groupsTable.revokeInvite(g, i)) : apiFetch(`/groups/${g}/invites/${i}`, groupInviteListSchema, { method: 'DELETE' })),
    'Einladung widerrufen.',
  )
}

/** Gerichtete Einladung an einen Nutzer (Admin). */
export function useCreateDirectedInvite(groupId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: number): Promise<GroupInvite[]> =>
      USE_MOCKS
        ? mockWrite(() => groupsTable.createDirectedInvite(groupId, userId))
        : apiFetch(`/groups/${groupId}/invites`, groupInviteListSchema, { method: 'POST', body: { user_id: userId } }),
    onSuccess: (invites) => {
      qc.setQueryData(qk.groups.invites(groupId), invites)
      toast.success('Einladung gesendet.')
    },
  })
}

/** Eigenen offenen Beitrittsantrag zurückziehen. */
export function useWithdrawRequest() {
  return useGroupMembershipMutation(
    ({ id }) => (USE_MOCKS ? mockWrite(() => groupsTable.withdrawRequest(id)) : apiFetch(`/groups/${id}/join-requests/mine`, groupDetailSchema, { method: 'DELETE' })),
    'Anfrage zurückgezogen.',
  )
}

/** Channels verwalten (Admin) — Channels sind Konversationen (ADR-005), daher Chat-Cache mit auffrischen. */
export function useCreateChannel(groupId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, groupTitle }: { name: string; groupTitle: string }): Promise<void> => {
      if (USE_MOCKS) {
        await mockWrite(() => chatTable.addChannel(groupId, name, groupTitle))
        return
      }
      await apiFetch(`/groups/${groupId}/channels`, groupChannelListSchema, { method: 'POST', body: { name } })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.groups.channels(groupId) })
      qc.invalidateQueries({ queryKey: qk.chat.conversations })
      toast.success('Channel erstellt.')
    },
  })
}

export function useRenameChannel(groupId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ conversationId, name }: { conversationId: number; name: string }): Promise<void> => {
      if (USE_MOCKS) {
        await mockWrite(() => chatTable.renameChannel(conversationId, name))
        return
      }
      await apiFetch(`/groups/${groupId}/channels/${conversationId}`, groupChannelListSchema, { method: 'PATCH', body: { name } })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.groups.channels(groupId) })
      qc.invalidateQueries({ queryKey: qk.chat.conversations })
    },
  })
}

export function useDeleteChannel(groupId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (conversationId: number): Promise<void> => {
      if (USE_MOCKS) {
        await mockWrite(() => chatTable.deleteChannel(conversationId))
        return
      }
      await apiFetch(`/groups/${groupId}/channels/${conversationId}`, groupChannelListSchema, { method: 'DELETE' })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.groups.channels(groupId) })
      qc.invalidateQueries({ queryKey: qk.chat.conversations })
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Löschen fehlgeschlagen.'),
  })
}
