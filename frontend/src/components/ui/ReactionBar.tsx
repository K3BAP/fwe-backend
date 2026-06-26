import { useState } from 'react'
import { cn } from '@/lib/cn'
import type { Reaction } from '@/api/schemas'

const PALETTE = ['👍', '🔥', '🪂', '❤️', '😂', '🥾']

/** Reaktionsleiste: bestehende Reaktionen (toggle) + kleiner Emoji-Picker zum Hinzufügen. */
export function ReactionBar({ reactions, onReact }: { reactions: Reaction[]; onReact: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onReact(r.emoji)}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition',
            r.me ? 'border-primary/40 bg-primary/10 text-primary' : 'border-base-300 bg-base-100 hover:bg-base-200',
          )}
        >
          <span>{r.emoji}</span>
          <span className="text-xs font-semibold">{r.count}</span>
        </button>
      ))}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          aria-label="Reaktion hinzufügen"
          className="grid size-7 place-items-center rounded-full border border-base-300 text-base-content/50 transition hover:bg-base-200"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01" />
          </svg>
        </button>
        {open && (
          <div className="absolute z-20 mt-1 flex gap-1 rounded-2xl border border-base-300 bg-base-100 p-1.5 shadow-popover">
            {PALETTE.map((e) => (
              <button
                key={e}
                type="button"
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => {
                  onReact(e)
                  setOpen(false)
                }}
                className="rounded-lg px-1.5 py-1 text-lg transition hover:bg-base-200"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
