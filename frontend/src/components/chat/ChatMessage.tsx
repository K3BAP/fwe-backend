import { Avatar, ReactionBar } from '@/components/ui'
import type { Message } from '@/api/schemas'
import { cn } from '@/lib/cn'
import { formatClock } from '@/lib/format'

function ReplyQuote({ reply, own }: { reply: NonNullable<Message['reply_to']>; own: boolean }) {
  return (
    <div className={cn('mb-1.5 rounded-lg border-l-2 px-2 py-1 text-xs', own ? 'border-white/50 bg-white/15' : 'border-base-300 bg-base-200')}>
      <div className="font-semibold opacity-90">{reply.sender_name}</div>
      <div className="truncate opacity-75">{reply.body ?? 'Nachricht gelöscht'}</div>
    </div>
  )
}

/** Eine Chat-Nachricht (Design-System §09): eigen / eingehend / Ersteller, mit Reply & Reaktionen. */
export function ChatMessage({
  message: m,
  currentUserId,
  showSender,
  onReact,
  onReply,
}: {
  message: Message
  currentUserId: number
  showSender: boolean
  onReact: (emoji: string) => void
  onReply: (message: Message) => void
}) {
  const own = m.sender.id === currentUserId

  if (m.deleted_at != null) {
    return (
      <div className={cn('flex', own ? 'justify-end' : 'justify-start')}>
        <div className="rounded-2xl bg-base-200 px-3.5 py-2 text-sm italic text-base-content/45">Nachricht wurde gelöscht</div>
      </div>
    )
  }

  const meta = (
    <button type="button" onClick={() => onReply(m)} className="text-xs text-base-content/40 transition hover:text-base-content">
      Antworten
    </button>
  )
  const time = (
    <span className="text-xs text-base-content/45">
      {formatClock(m.created_at)}
      {m.edited_at && ' · bearbeitet'}
    </span>
  )

  if (own) {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[80%] flex-col items-end">
          <div className="rounded-[18px_18px_6px_18px] bg-primary px-3.5 py-2.5 text-sm text-primary-content">
            {m.reply_to && <ReplyQuote reply={m.reply_to} own />}
            <div className="whitespace-pre-wrap break-words">{m.body}</div>
          </div>
          <div className="mt-1 flex items-center gap-2">
            {meta}
            {time}
          </div>
          {m.reactions.length > 0 && (
            <div className="mt-1">
              <ReactionBar reactions={m.reactions} onReact={onReact} />
            </div>
          )}
        </div>
      </div>
    )
  }

  const creator = m.is_creator
  return (
    <div className="flex max-w-[88%] gap-2.5">
      <Avatar name={m.sender.display_name} src={m.sender.avatar_path} size={34} highlight={creator} className="self-end" />
      <div className="min-w-0">
        {showSender && (
          <div className="mb-0.5 flex items-center gap-1.5 pl-1">
            <span className={cn('text-xs font-semibold', creator ? 'text-coral-700' : 'text-base-content/60')}>{m.sender.display_name}</span>
            {creator && (
              <span className="rounded-full bg-coral-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-coral-700">Ersteller</span>
            )}
          </div>
        )}
        <div
          className={cn(
            'px-3.5 py-2.5 text-sm',
            creator
              ? 'rounded-[14px_18px_18px_6px] border border-coral-500/25 border-l-[3px] border-l-coral-500 bg-coral-500/10'
              : 'rounded-[18px_18px_18px_6px] border border-base-300 bg-base-100',
          )}
        >
          {m.reply_to && <ReplyQuote reply={m.reply_to} own={false} />}
          <div className="whitespace-pre-wrap break-words">{m.body}</div>
        </div>
        <div className="mt-1 flex items-center gap-2 pl-1">
          {meta}
          {time}
        </div>
        <div className="mt-1 pl-1">
          <ReactionBar reactions={m.reactions} onReact={onReact} />
        </div>
      </div>
    </div>
  )
}
