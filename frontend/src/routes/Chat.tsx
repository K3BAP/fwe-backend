import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useConversations } from '@/api/chat'
import { ChatThread } from '@/components/chat/ChatThread'
import { ConversationListItem } from '@/components/chat/ConversationListItem'
import { Skeleton, Stagger, StaggerItem } from '@/components/ui'
import { ChatIcon } from '@/components/layout/icons'
import { cn } from '@/lib/cn'

function ChatEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-base-200 text-primary">
        <ChatIcon size={26} />
      </span>
      <p className="font-display text-lg">Wähle eine Konversation</p>
      <p className="max-w-xs text-sm text-base-content/55">
        Channels, Treffen-Chats und Direktnachrichten an einem Ort.
      </p>
    </div>
  )
}

/**
 * Chat als Vollbild-2-Spalter (Prototyp): Konversationsliste links, Verlauf rechts. Eine Route, `:id`
 * wählt den Thread. Auf Mobile zeigt die Seite jeweils nur eine Spalte (Liste **oder** Thread).
 */
export function Chat() {
  const { id } = useParams()
  const convId = id ? Number(id) : null
  const conversations = useConversations()
  const [query, setQuery] = useState('')

  const all = conversations.data ?? []
  const q = query.trim().toLowerCase()
  const filtered = q ? all.filter((c) => c.title.toLowerCase().includes(q)) : all

  return (
    <div className="flex h-full min-h-0">
      <aside className={cn('flex w-full min-h-0 flex-col border-base-300 md:w-[340px] md:border-r', convId != null && 'hidden md:flex')}>
        <div className="flex-shrink-0 space-y-3 px-4 pb-2 pt-5">
          <h1 className="font-display text-xl">Chat</h1>
          <label className="flex items-center gap-2.5 rounded-[14px] border-[1.5px] border-base-300 bg-base-100 px-3.5 py-2.5 focus-within:border-primary">
            <svg className="size-[18px] shrink-0 text-base-content/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Durchsuchen…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-base-content/45"
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-24 md:pb-3">
          {conversations.isLoading && (
            <div className="space-y-0.5">
              {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="mb-1 h-16 w-full" />)}
            </div>
          )}
          {!conversations.isLoading && filtered.length > 0 && (
            <Stagger className="space-y-0.5">
              {filtered.map((c) => (
                <StaggerItem key={c.id}>
                  <ConversationListItem conversation={c} active={c.id === convId} />
                </StaggerItem>
              ))}
            </Stagger>
          )}
          {!conversations.isLoading && filtered.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-base-content/55">
              {query ? 'Keine Treffer.' : 'Noch keine Konversationen.'}
            </p>
          )}
        </div>
      </aside>

      <section className={cn('min-w-0 flex-1', convId == null && 'hidden md:block')}>
        {convId != null ? <ChatThread key={convId} conversationId={convId} backTo="/chat" /> : <ChatEmpty />}
      </section>
    </div>
  )
}
