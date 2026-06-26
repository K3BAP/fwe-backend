import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useConversation, useMarkRead, useMessages, useReactToMessage, useSendMessage } from '@/api/chat'
import type { Message } from '@/api/schemas'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { MessageComposer } from '@/components/chat/MessageComposer'
import { Skeleton } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'

/**
 * Konversations-Verlauf (Header + Nachrichten + Eingabe). Wiederverwendet für globalen Chat und
 * gruppen-gerahmte Channels — `backTo` steuert nur das mobile Zurück-Ziel.
 */
export function ChatThread({ conversationId, backTo }: { conversationId: number; backTo: string }) {
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
        <Link to={backTo} className="btn btn-circle btn-ghost btn-sm text-lg md:hidden" aria-label="Zurück">
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
