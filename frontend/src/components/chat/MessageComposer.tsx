import { useState } from 'react'
import type { Message } from '@/api/schemas'
import { SendIcon } from '@/components/layout/icons'

/** Eingabezeile: Pill-Input + Senden, mit optionaler Antwort-Vorschau. */
export function MessageComposer({
  onSend,
  replyTo,
  onCancelReply,
  disabled,
}: {
  onSend: (text: string) => void
  replyTo: Message | null
  onCancelReply: () => void
  disabled?: boolean
}) {
  const [text, setText] = useState('')

  const send = () => {
    const t = text.trim()
    if (!t) return
    onSend(t)
    setText('')
  }

  return (
    <div className="border-t border-base-300 p-3">
      {replyTo && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-base-200 px-3 py-1.5 text-sm">
          <span className="min-w-0 truncate">
            Antwort an <span className="font-semibold">{replyTo.sender.display_name}</span>
            {replyTo.body ? `: ${replyTo.body}` : ''}
          </span>
          <button type="button" onClick={onCancelReply} aria-label="Antwort verwerfen" className="shrink-0 text-base-content/50 hover:text-base-content">
            ✕
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-full border-[1.5px] border-base-300 bg-base-100 px-4 py-2.5 text-sm outline-none transition placeholder:text-base-content/40 focus:border-primary focus:ring-4 focus:ring-primary/15"
          placeholder="Nachricht schreiben…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={disabled || !text.trim()}
          aria-label="Senden"
          className="btn btn-circle btn-primary"
        >
          <SendIcon size={20} />
        </button>
      </div>
    </div>
  )
}
