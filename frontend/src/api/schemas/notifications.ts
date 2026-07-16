import { z } from 'zod'
import { publicUserCardSchema } from './common'

/** Benachrichtigungs-DTOs (API.md §11, ADR-008). `read_at = null` ⇒ ungelesen. */

export const notificationTypeSchema = z.enum([
  'meetup_join',
  'meetup_cancelled',
  'group_join_request',
  'group_request_approved',
  'group_invite',
  'new_message',
  'message_reaction',
  'group_feed_post',
])
export type NotificationType = z.infer<typeof notificationTypeSchema>

/** Vor-gerenderte Notification (Text + Ziel-Link) für ein nachladefreies Center. */
export const notificationSchema = z.object({
  id: z.number(),
  type: notificationTypeSchema,
  actor: publicUserCardSchema.nullable(),
  text: z.string(),
  link: z.string().nullable(),
  read_at: z.string().nullable(),
  created_at: z.string(),
})
export type Notification = z.infer<typeof notificationSchema>
export const notificationListSchema = z.array(notificationSchema)
