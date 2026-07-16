import { z } from 'zod'
import { publicUserCardSchema, reactionSchema } from './common'

/** Chat-DTOs (API.md §9–10, DATA_MODEL §7). Polymorphe Engine: Channel / Treffen / DM. */

export const conversationTypeSchema = z.enum(['group_channel', 'meetup', 'direct'])
export type ConversationType = z.infer<typeof conversationTypeSchema>

/** Listen-Projektion (Sidebar): letzter Beitrag, Ungelesen-Zähler, DM-Partner. */
export const conversationListItemSchema = z.object({
  id: z.number(),
  type: conversationTypeSchema,
  title: z.string(),
  /** DM-Gegenüber (für Avatar); bei Channel/Treffen null. */
  peer: publicUserCardSchema.nullable(),
  last_message: z
    .object({ body: z.string().nullable(), sender_name: z.string(), created_at: z.string() })
    .nullable(),
  unread_count: z.number(),
  last_message_at: z.string().nullable(),
})
export type ConversationListItem = z.infer<typeof conversationListItemSchema>
export const conversationListSchema = z.array(conversationListItemSchema)

export const conversationDetailSchema = z.object({
  id: z.number(),
  type: conversationTypeSchema,
  title: z.string(),
  peer: publicUserCardSchema.nullable(),
  participants: z.array(publicUserCardSchema),
  /** Ersteller (nur Treffen-Chat) — für die `is_creator`-Hervorhebung. */
  creator_user_id: z.number().nullable(),
})
export type ConversationDetail = z.infer<typeof conversationDetailSchema>

/** Vorschau der zitierten Nachricht (Reply). */
export const replyPreviewSchema = z.object({
  id: z.number(),
  sender_name: z.string(),
  body: z.string().nullable(),
})

export const messageSchema = z.object({
  id: z.number(),
  conversation_id: z.number(),
  sender: publicUserCardSchema,
  body: z.string().nullable(), // null bei gelöscht (Tombstone)
  reply_to: replyPreviewSchema.nullable(),
  is_creator: z.boolean(), // Treffen-Ersteller-Hervorhebung
  created_at: z.string(),
  edited_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
  reactions: z.array(reactionSchema),
})
export type Message = z.infer<typeof messageSchema>
export const messageListSchema = z.array(messageSchema)
