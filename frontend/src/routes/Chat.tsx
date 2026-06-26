import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  useConversation,
  useConversations,
  useMarkRead,
  useMessages,
  useReactToMessage,
  useSendMessage,
} from '@/api/chat'
import type { Message } from '@/api/schemas'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { ConversationListItem } from '@/components/chat/ConversationListItem'
import { MessageComposer } from '@/components/chat/MessageComposer'
import { Card, Skeleton } from '@/components/ui'
import { ChatIcon } from '@/components/layout/icons'
import { useAuthStore } from '@/stores/authStore'
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

function ChatThread({ conversationId }: { conversationId: number }) {
  const conv = useConversation(conversationId)
  const messages = useMessages(conversationId)
  const send = useSendMessage(conversationId)
  const react = useReactToMessage(conversationId)
  const { mutate: markRead } = useMarkRead()
  const currentUserId = useAuthStore((s) => s.user?.id ?? 0)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    markRead(conversationId)
  }, [conversationId, markRead])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.data?.length])

  const showSender = conv.data?.type !== 'direct'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-base-300 p-3">
        <Link to="/chat" className="btn btn-circle btn-ghost btn-sm text-lg md:hidden" aria-label="Zurück">
          ←
        </Link>
        <div className="min-w-0">
          <div className="truncate font-display text-lg leading-tight">{conv.data?.title ?? '…'}</div>
          {conv.data && (
            <div className="truncate text-xs text-base-content/50">
              {conv.data.type === 'direct'
                ? conv.data.peer?.handle
                  ? `@${conv.data.peer.handle}`
                  : 'Direktnachricht'
                : `${conv.data.participants.length} Mitglieder`}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.isLoading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12 w-2/3" />)}
          </div>
        )}
        <div className="flex flex-col gap-3">
          {messages.data?.map((m) => (
            <ChatMessage
              key={m.id}
              message={m}
              currentUserId={currentUserId}
              showSender={showSender}
              onReact={(emoji) => react.mutate({ messageId: m.id, emoji })}
              onReply={setReplyTo}
            />
          ))}
        </div>
        <div ref={endRef} />
      </div>

      <MessageComposer
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        disabled={send.isPending}
        onSend={(text) => {
          send.mutate({
            body: text,
            replyTo: replyTo ? { id: replyTo.id, sender_name: replyTo.sender.display_name, body: replyTo.body } : undefined,
          })
          setReplyTo(null)
        }}
      />
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
        {convId != null ? <ChatThread key={convId} conversationId={convId} /> : <ChatEmpty />}
      </main>
    </Card>
  )
}
