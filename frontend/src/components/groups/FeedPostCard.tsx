import { Avatar, Card, Menu, Pill, ReactionBar, type MenuItemDef } from '@/components/ui'
import type { FeedPost } from '@/api/schemas'
import { formatRelativeTime } from '@/lib/format'

/** Einzelner Feed-Post mit Autor, optionalem Pin, Inhalt, Reaktionsleiste und Aktionen (Autor/Admin). */
export function FeedPostCard({
  post,
  onReact,
  currentUserId,
  canManage,
  onPin,
  onEdit,
  onDelete,
}: {
  post: FeedPost
  onReact: (emoji: string) => void
  currentUserId?: number
  canManage?: boolean
  onPin?: (post: FeedPost) => void
  onEdit?: (post: FeedPost) => void
  onDelete?: (post: FeedPost) => void
}) {
  const canEdit = post.author.id === currentUserId || canManage
  const items: MenuItemDef[] = []
  if (canManage && onPin) items.push({ label: post.is_pinned ? 'Pin lösen' : 'Anpinnen', onSelect: () => onPin(post) })
  if (canEdit && onEdit) items.push({ label: 'Bearbeiten', onSelect: () => onEdit(post) })
  if (canEdit && onDelete) items.push({ label: 'Löschen', danger: true, onSelect: () => onDelete(post) })

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <Avatar name={post.author.display_name} src={post.author.avatar_path} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-tight">{post.author.display_name}</div>
          <div className="text-xs text-base-content/50">
            {formatRelativeTime(post.created_at)}
            {post.updated_at && ' · bearbeitet'}
          </div>
        </div>
        {post.is_pinned && (
          <Pill bg="#FFE1D8" fg="#C7421F">
            📌 Angepinnt
          </Pill>
        )}
        {items.length > 0 && <Menu items={items} label="Beitrag" />}
      </div>
      {post.title && <h3 className="mt-3 font-display text-lg">{post.title}</h3>}
      <p className="mt-2 whitespace-pre-line leading-relaxed text-base-content/80">{post.body}</p>
      <div className="mt-4">
        <ReactionBar reactions={post.reactions} onReact={onReact} />
      </div>
    </Card>
  )
}
