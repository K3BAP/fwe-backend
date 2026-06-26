import { z } from 'zod'
import { publicUserCardSchema, reactionSchema } from './common'

/** Gruppen-DTOs (API.md §6, DATA_MODEL §5). */

export const groupVisibilitySchema = z.enum(['public', 'private', 'unlisted'])
export type GroupVisibility = z.infer<typeof groupVisibilitySchema>

export const groupJoinPolicySchema = z.enum(['open', 'request', 'invite_only'])
export type GroupJoinPolicy = z.infer<typeof groupJoinPolicySchema>

/** Listen-Projektion einer Gruppe (Verzeichnis, Dashboard-Scroll). */
export const groupListItemSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  logo_path: z.string().nullable(),
  region: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  visibility: groupVisibilitySchema,
  join_policy: groupJoinPolicySchema,
  members_count: z.number(),
})
export type GroupListItem = z.infer<typeof groupListItemSchema>

export const groupListSchema = z.array(groupListItemSchema)

export const groupRoleSchema = z.enum(['owner', 'admin', 'moderator', 'member'])
export type GroupRole = z.infer<typeof groupRoleSchema>

export const membershipStatusSchema = z.enum(['active', 'banned'])

/** Ein Channel (= conversation type=group_channel) — in Slice 3 nur Anzeige, Chat folgt in Slice 4. */
export const groupChannelSchema = z.object({
  id: z.number(),
  title: z.string(),
  is_default: z.boolean(),
})
export type GroupChannel = z.infer<typeof groupChannelSchema>

/** Detail-Projektion einer Gruppe (+ eigene Mitgliedschaft, Verwaltungsrecht, Channels). */
export const groupDetailSchema = groupListItemSchema.extend({
  rules_text: z.string().nullable(),
  owner_user_id: z.number(),
  my_membership: z.object({ role: groupRoleSchema, status: membershipStatusSchema }).nullable(),
  can_manage: z.boolean(),
  channels: z.array(groupChannelSchema),
})
export type GroupDetail = z.infer<typeof groupDetailSchema>

export const groupMemberSchema = z.object({
  user: publicUserCardSchema,
  role: groupRoleSchema,
  status: membershipStatusSchema,
  joined_at: z.string(),
})
export type GroupMember = z.infer<typeof groupMemberSchema>
export const groupMemberListSchema = z.array(groupMemberSchema)

/** Gruppen-Feed-Post (Admin/Owner) mit aggregierten Reaktionen (API.md §8). */
export const feedPostSchema = z.object({
  id: z.number(),
  group_id: z.number(),
  author: publicUserCardSchema,
  title: z.string().nullable(),
  body: z.string(),
  image_path: z.string().nullable(),
  is_pinned: z.boolean(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  reactions: z.array(reactionSchema),
})
export type FeedPost = z.infer<typeof feedPostSchema>
export const feedPostListSchema = z.array(feedPostSchema)

export const joinRequestSchema = z.object({
  id: z.number(),
  user: publicUserCardSchema,
  message: z.string().nullable(),
  status: z.enum(['pending', 'approved', 'rejected']),
  created_at: z.string(),
})
export type JoinRequest = z.infer<typeof joinRequestSchema>
export const joinRequestListSchema = z.array(joinRequestSchema)

export const groupInviteSchema = z.object({
  id: z.number(),
  invited_user: publicUserCardSchema.nullable(),
  token: z.string().nullable(),
  status: z.enum(['pending', 'accepted', 'revoked', 'expired']),
  max_uses: z.number().nullable(),
  uses_count: z.number(),
})
export type GroupInvite = z.infer<typeof groupInviteSchema>
export const groupInviteListSchema = z.array(groupInviteSchema)

/** Eingabe für „Gruppe erstellen". */
export const groupCreateInputSchema = z.object({
  name: z.string().min(3, 'Mindestens 3 Zeichen.').max(80, 'Höchstens 80 Zeichen.'),
  description: z.string().max(2000).nullable(),
  region: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  rules_text: z.string().max(5000).nullable(),
  visibility: groupVisibilitySchema,
  join_policy: groupJoinPolicySchema,
})
export type GroupCreateInput = z.infer<typeof groupCreateInputSchema>
