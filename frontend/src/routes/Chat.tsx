import { useParams } from 'react-router-dom'
import { useConversations } from '@/api/chat'
import { ChatThread } from '@/components/chat/ChatThread'
import { ConversationListItem } from '@/components/chat/ConversationListItem'
import { Card, Skeleton } from '@/components/ui'
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

/** Chat: Master-Detail (Konversationsliste + Verlauf). Eine Route, `:id` wählt den Thread. */
export function Chat() {
  const { id } = useParams()
  const convId = id ? Number(id) : null
  const conversations = useConversations()

  return (
    <Card className="flex h-[72vh] min-h-[500px] overflow-hidden">
      <aside className={cn('flex w-full flex-col border-base-300 md:w-80 md:border-r', convId != null && 'hidden md:flex')}>
        <div className="border-b border-base-300 px-4 py-3.5">
          <h1 className="font-display text-xl">Chat</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.isLoading &&
            Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="mb-1 h-16 w-full" />)}
          {conversations.data?.map((c) => (
            <ConversationListItem key={c.id} conversation={c} active={c.id === convId} />
          ))}
          {conversations.data && conversations.data.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-base-content/55">Noch keine Konversationen.</p>
          )}
        </div>
      </aside>

      <main className={cn('min-w-0 flex-1', convId == null && 'hidden md:block')}>
        {convId != null ? <ChatThread key={convId} conversationId={convId} backTo="/chat" /> : <ChatEmpty />}
      </main>
    </Card>
  )
}
