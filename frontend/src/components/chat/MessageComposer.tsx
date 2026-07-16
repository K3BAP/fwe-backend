import { useState } from 'react'
import type { Message } from '@/api/schemas'
import { SendIcon } from '@/components/layout/icons'

/** Eingabezeile: Pill-Input + Senden. Unterstützt Antwort-Vorschau und Bearbeiten-Modus. */
export function MessageComposer({
  onSend,
  onSaveEdit,
  editing,
  onCancelEdit,
  replyTo,
  onCancelReply,
  disabled,
}: {
  onSend: (text: string) => void
  onSaveEdit?: (text: string) => void
  editing?: Message | null
  onCancelEdit?: () => void
  replyTo: Message | null
  onCancelReply: () => void
  disabled?: boolean
}) {
  // Anfangswert aus `editing`; das Umschalten Senden↔Bearbeiten remountet via `key` (siehe ChatThread).
  const [text, setText] = useState(editing?.body ?? '')

  const submit = () => {
    const t = text.trim()
    if (!t) return
    if (editing) onSaveEdit?.(t)
    else onSend(t)
    setText('')
  }

  return (
    <div className="border-t border-base-300 p-3">
      {editing ? (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-primary/10 px-3 py-1.5 text-sm text-primary">
          <span className="min-w-0 truncate font-medium">Nachricht bearbeiten…</span>
          <button
            type="button"
            onClick={() => {
              onCancelEdit?.()
              setText('')
            }}
            aria-label="Bearbeiten abbrechen"
            className="shrink-0 hover:opacity-70"
          >
            ✕
          </button>
        </div>
      ) : replyTo ? (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-base-200 px-3 py-1.5 text-sm">
          <span className="min-w-0 truncate">
            Antwort an <span className="font-semibold">{replyTo.sender.display_name}</span>
            {replyTo.body ? `: ${replyTo.body}` : ''}
          </span>
          <button type="button" onClick={onCancelReply} aria-label="Antwort verwerfen" className="shrink-0 text-base-content/50 hover:text-base-content">
            ✕
          </button>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-full border-[1.5px] border-base-300 bg-base-100 px-4 py-2.5 text-sm outline-none transition placeholder:text-base-content/40 focus:border-primary focus:ring-4 focus:ring-primary/15"
          placeholder={editing ? 'Nachricht bearbeiten…' : 'Nachricht schreiben…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />
        {editing ? (
          <button type="button" onClick={submit} disabled={disabled || !text.trim()} className="btn btn-primary rounded-full">
            Speichern
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={disabled || !text.trim()} aria-label="Senden" className="btn btn-circle btn-primary">
            <SendIcon size={20} />
          </button>
        )}
      </div>
    </div>
  )
}
