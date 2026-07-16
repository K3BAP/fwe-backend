import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Avatar } from './Avatar'

export type Reaction = { emoji: string; count: number }

export type MessageBubbleProps = {
  author: string
  time?: string
  children: ReactNode
  /** Eigene Nachricht → rechtsbündige Sky-Bubble. */
  own?: boolean
  /** Ersteller-Hervorhebung im Treffen-Chat (Coral). */
  creator?: boolean
  reactions?: Reaction[]
}

/** Chat-Nachricht (Design-System §09) — eingehend / eigen / Ersteller-hervorgehoben. */
export function MessageBubble({ author, time, children, own, creator, reactions }: MessageBubbleProps) {
  if (own) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%]">
          <div className="rounded-[18px_18px_6px_18px] bg-primary px-3.5 py-2.5 text-sm text-primary-content">
            {children}
          </div>
          {time && <div className="mt-1 text-right text-xs text-base-content/50">{time}</div>}
        </div>
      </div>
    )
  }
  return (
    <div className="flex max-w-[88%] gap-2.5">
      <Avatar name={author} size={34} highlight={creator} className="self-end" />
      <div className="min-w-0">
        <div className="mb-0.5 flex items-center gap-1.5 pl-1">
          <span className={cn('text-xs font-semibold', creator ? 'text-coral-700' : 'text-base-content/60')}>
            {author}
          </span>
          {creator && (
            <span className="rounded-full bg-coral-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-coral-700">
              Ersteller
            </span>
          )}
        </div>
        <div
          className={cn(
            'px-3.5 py-2.5 text-sm',
            creator
              ? 'rounded-[14px_18px_18px_6px] border border-coral-500/25 border-l-[3px] border-l-coral-500 bg-coral-500/10 text-base-content'
              : 'rounded-[18px_18px_18px_6px] border border-base-300 bg-base-100',
          )}
        >
          {children}
        </div>
        {reactions && reactions.length > 0 && (
          <div className="mt-1.5 flex gap-1.5 pl-1">
            {reactions.map((r) => (
              <span
                key={r.emoji}
                className="rounded-full border border-base-300 bg-base-100 px-2 py-0.5 text-xs font-semibold"
              >
                {r.emoji} {r.count}
              </span>
            ))}
          </div>
        )}
        {time && !creator && <div className="mt-1 pl-1 text-xs text-base-content/50">{time}</div>}
      </div>
    </div>
  )
}
