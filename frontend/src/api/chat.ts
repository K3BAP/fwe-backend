import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { USE_MOCKS } from '@/config'
import { chatTable } from '@/mocks/chat'
import { mockRead, mockWrite } from '@/mocks/runtime'
import { useAuthStore, type SessionUser } from '@/stores/authStore'
import { apiFetch } from './http'
import { qk } from './queryKeys'
import {
  conversationDetailSchema,
  conversationListSchema,
  messageListSchema,
  messageSchema,
  type ConversationDetail,
  type ConversationListItem,
  type Message,
  type PublicUserCard,
  type Reaction,
} from './schemas'

/**
 * Chat-Naht (ADR-016): in M1 aus dem Mock-Store (statischer Verlauf, kein Polling), ab M5 auf echte
 * Endpunkte + gestaffeltes Polling umgestellt — Hooks/Komponenten bleiben gleich.
 */
function meCard(user: SessionUser | null): PublicUserCard {
  return user
    ? { id: user.id, display_name: user.displayName, handle: null, avatar_path: user.avatarUrl }
    : { id: 0, display_name: 'Du', handle: null, avatar_path: null }
}

/** Toggle einer Emoji-Reaktion auf einer Reaktionsliste (optimistisch). */
function toggleReactionList(reactions: Reaction[], emoji: string): Reaction[] {
  const existing = reactions.find((r) => r.emoji === emoji)
  if (!existing) return [...reactions, { emoji, count: 1, me: true }]
  if (existing.me) return reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, me: false } : r)).filter((r) => r.count > 0)
  return reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, me: true } : r))
}

async function fetchConversations(): Promise<ConversationListItem[]> {
  if (USE_MOCKS.chat) return mockRead(() => chatTable.list(), { emptyValue: [] })
  return apiFetch('/conversations', conversationListSchema)
}
async function fetchConversation(id: number): Promise<ConversationDetail> {
  if (USE_MOCKS.chat) return mockRead(() => chatTable.detail(id))
  return apiFetch(`/conversations/${id}`, conversationDetailSchema)
}
async function fetchMessages(id: number): Promise<Message[]> {
  if (USE_MOCKS.chat) return mockRead(() => chatTable.messages(id), { emptyValue: [] })
  return apiFetch(`/conversations/${id}/messages`, messageListSchema)
}

export function useConversations() {
  return useQuery({ queryKey: qk.chat.conversations, queryFn: fetchConversations })
}
export function useConversation(id: number) {
  return useQuery({ queryKey: qk.chat.detail(id), queryFn: () => fetchConversation(id), enabled: Number.isFinite(id) })
}
export function useMessages(id: number) {
  return useQuery({ queryKey: qk.chat.messages(id), queryFn: () => fetchMessages(id), enabled: Number.isFinite(id) })
}

export function useChatUnread() {
  return useQuery({
    queryKey: qk.chat.unread,
    queryFn: async () => (USE_MOCKS.chat ? mockRead(() => chatTable.unreadTotal()) : apiFetch('/conversations/unread-count', z.number())),
  })
}

let tempId = -1

/** Nachricht senden, optimistisch ans Ende des Verlaufs angehängt. */
export function useSendMessage(conversationId: number) {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const key = qk.chat.messages(conversationId)
  return useMutation({
    mutationFn: ({ body, replyTo }: { body: string; replyTo?: Message['reply_to'] }): Promise<Message> =>
      USE_MOCKS.chat
        ? mockWrite(() => chatTable.send(conversationId, body, replyTo?.id ?? null))
        : apiFetch(`/conversations/${conversationId}/messages`, messageSchema, { method: 'POST', body: { body, reply_to_id: replyTo?.id ?? null } }),
    onMutate: async ({ body, replyTo }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Message[]>(key)
      const id = tempId--
      const optimistic: Message = {
        id,
        conversation_id: conversationId,
        sender: meCard(user),
        body,
        reply_to: replyTo ?? null,
        is_creator: false,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
        reactions: [],
      }
      qc.setQueryData<Message[]>(key, [...(prev ?? []), optimistic])
      return { prev, id }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(key, ctx.prev),
    onSuccess: (real, _v, ctx) => qc.setQueryData<Message[]>(key, (old) => (old ?? []).map((m) => (m.id === ctx?.id ? real : m))),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.chat.conversations }),
  })
}

/** Emoji-Reaktion auf eine Nachricht, optimistisch. */
export function useReactToMessage(conversationId: number) {
  const qc = useQueryClient()
  const key = qk.chat.messages(conversationId)
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: number; emoji: string }): Promise<Message> =>
      USE_MOCKS.chat
        ? mockWrite(() => chatTable.react(conversationId, messageId, emoji))
        : apiFetch(`/conversations/${conversationId}/messages/${messageId}/reactions`, messageSchema, { method: 'POST', body: { emoji } }),
    onMutate: async ({ messageId, emoji }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Message[]>(key)
      if (prev) qc.setQueryData(key, prev.map((m) => (m.id === messageId ? { ...m, reactions: toggleReactionList(m.reactions, emoji) } : m)))
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(key, ctx.prev),
    onSuccess: (real) => qc.setQueryData<Message[]>(key, (old) => old?.map((m) => (m.id === real.id ? real : m))),
  })
}

/** Eigene Nachricht bearbeiten — ersetzt sie im Cache. */
export function useEditMessage(conversationId: number) {
  const qc = useQueryClient()
  const key = qk.chat.messages(conversationId)
  return useMutation({
    mutationFn: ({ messageId, body }: { messageId: number; body: string }): Promise<Message> =>
      USE_MOCKS.chat
        ? mockWrite(() => chatTable.editMessage(conversationId, messageId, body))
        : apiFetch(`/conversations/${conversationId}/messages/${messageId}`, messageSchema, { method: 'PATCH', body: { body } }),
    onSuccess: (real) => qc.setQueryData<Message[]>(key, (old) => old?.map((m) => (m.id === real.id ? real : m))),
  })
}

/** Eigene Nachricht löschen (Tombstone). */
export function useDeleteMessage(conversationId: number) {
  const qc = useQueryClient()
  const key = qk.chat.messages(conversationId)
  return useMutation({
    mutationFn: (messageId: number): Promise<Message> =>
      USE_MOCKS.chat
        ? mockWrite(() => chatTable.deleteMessage(conversationId, messageId))
        : apiFetch(`/conversations/${conversationId}/messages/${messageId}`, messageSchema, { method: 'DELETE' }),
    onSuccess: (real) => qc.setQueryData<Message[]>(key, (old) => old?.map((m) => (m.id === real.id ? real : m))),
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (conversationId: number): Promise<void> => {
      if (USE_MOCKS.chat) {
        await mockWrite(() => chatTable.markRead(conversationId))
        return
      }
      await apiFetch(`/conversations/${conversationId}/read`, conversationListSchema, { method: 'POST' })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.chat.conversations })
      qc.invalidateQueries({ queryKey: qk.chat.unread })
    },
  })
}

/** „Direktchat öffnen" (Profil → DM). Gibt die Konversations-ID zurück. */
export function useOpenDm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: number): Promise<number> => {
      if (USE_MOCKS.chat) return mockWrite(() => chatTable.findOrCreateDm(userId))
      const res = await apiFetch('/conversations/direct', z.object({ id: z.number() }), { method: 'POST', body: { user_id: userId } })
      return res.id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.chat.conversations }),
  })
}
