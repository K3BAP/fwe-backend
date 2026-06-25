import { z } from 'zod'

/** Gruppen-DTOs (API.md §6, DATA_MODEL §5). Detail/Feed/Mitglieder folgen in Slice 3. */

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
