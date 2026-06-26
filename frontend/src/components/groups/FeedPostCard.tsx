import { Avatar, Card, Pill } from '@/components/ui'
import type { FeedPost } from '@/api/schemas'
import { formatRelativeTime } from '@/lib/format'
import { ReactionBar } from './ReactionBar'

/** Einzelner Feed-Post mit Autor, optionalem Pin, Inhalt und Reaktionsleiste. */
export function FeedPostCard({ post, onReact }: { post: FeedPost; onReact: (emoji: string) => void }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <Avatar name={post.author.display_name} src={post.author.avatar_path} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-tight">{post.author.display_name}</div>
          <div className="text-xs text-base-content/50">{formatRelativeTime(post.created_at)}</div>
        </div>
        {post.is_pinned && (
          <Pill bg="#FFE1D8" fg="#C7421F">
            📌 Angepinnt
          </Pill>
        )}
      </div>
      {post.title && <h3 className="mt-3 font-display text-lg">{post.title}</h3>}
      <p className="mt-2 whitespace-pre-line leading-relaxed text-base-content/80">{post.body}</p>
      <div className="mt-4">
        <ReactionBar reactions={post.reactions} onReact={onReact} />
      </div>
    </Card>
  )
}
