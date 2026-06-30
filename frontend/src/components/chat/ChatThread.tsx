import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { tween } from '@/lib/motion'
import {
  useConversation,
  useDeleteMessage,
  useEditMessage,
  useMarkRead,
  useMessages,
  useReactToMessage,
  useSendMessage,
} from '@/api/chat'
import type { Message } from '@/api/schemas'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { ConversationAvatar } from '@/components/chat/ConversationAvatar'
import { MessageComposer } from '@/components/chat/MessageComposer'
import { Button, Modal, Skeleton } from '@/components/ui'
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
  const edit = useEditMessage(conversationId)
  const del = useDeleteMessage(conversationId)
  const { mutate: markRead } = useMarkRead()
  const currentUserId = useAuthStore((s) => s.user?.id ?? 0)
  const reduce = useReducedMotion()
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [editing, setEditing] = useState<Message | null>(null)
  const [deleting, setDeleting] = useState<Message | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const liveRef = useRef<HTMLParagraphElement>(null)
  const lastAnnouncedId = useRef<number | null>(null)

  useEffect(() => {
    markRead(conversationId)
  }, [conversationId, markRead])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.data?.length])

  // ARIA-Live: neu eingetroffene Fremd-Nachrichten (Polling) für Screenreader ansagen. Beim
  // ersten Laden nur die Wasserlinie merken, damit nicht der gesamte Verlauf vorgelesen wird.
  useEffect(() => {
    const list = messages.data
    if (!list || list.length === 0) return
    const last = list[list.length - 1]
    if (lastAnnouncedId.current === null) {
      lastAnnouncedId.current = last.id
      return
    }
    if (last.id !== lastAnnouncedId.current) {
      lastAnnouncedId.current = last.id
      // Live-Region imperativ befüllen (kein React-State im Effekt) → Screenreader liest die Ansage vor.
      if (liveRef.current && last.sender.id !== currentUserId && last.deleted_at == null && last.body) {
        liveRef.current.textContent = `Neue Nachricht von ${last.sender.display_name}: ${last.body}`
      }
    }
  }, [messages.data, currentUserId])

  const showSender = conv.data?.type !== 'direct'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2.5 border-b border-base-300 bg-base-100 p-3">
        <Link to={backTo} className="btn btn-circle btn-ghost btn-sm text-lg md:hidden" aria-label="Zurück">
          ←
        </Link>
        {conv.data && <ConversationAvatar type={conv.data.type} peer={conv.data.peer} title={conv.data.title} size={38} />}
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
            // Eingangsanimation gilt nur für neu gemountete Nachrichten (Reconciliation per m.id) —
            // beim Polling animiert also nur die neu eingetroffene Bubble, nicht der ganze Verlauf.
            <motion.div
              key={m.id}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={tween.fast}
            >
              <ChatMessage
                message={m}
                currentUserId={currentUserId}
                showSender={showSender}
                onReact={(emoji) => react.mutate({ messageId: m.id, emoji })}
                onReply={(msg) => {
                  setEditing(null)
                  setReplyTo(msg)
                }}
                onEdit={(msg) => {
                  setReplyTo(null)
                  setEditing(msg)
                }}
                onDelete={setDeleting}
              />
            </motion.div>
          ))}
        </div>
        <div ref={endRef} />
      </div>

      {/* Screenreader-Ansage neuer Fremd-Nachrichten (visuell verborgen, imperativ befüllt). */}
      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      <MessageComposer
        key={editing ? `edit-${editing.id}` : 'compose'}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        onSaveEdit={(text) => {
          if (editing) edit.mutate({ messageId: editing.id, body: text })
          setEditing(null)
        }}
        disabled={send.isPending || edit.isPending}
        onSend={(text) => {
          send.mutate({
            body: text,
            replyTo: replyTo ? { id: replyTo.id, sender_name: replyTo.sender.display_name, body: replyTo.body } : undefined,
          })
          setReplyTo(null)
        }}
      />

      <Modal
        open={deleting != null}
        onClose={() => setDeleting(null)}
        title="Nachricht löschen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Abbrechen
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                if (deleting) del.mutate(deleting.id)
                setDeleting(null)
              }}
            >
              Löschen
            </Button>
          </>
        }
      >
        <p className="text-base-content/70">Die Nachricht wird für alle entfernt und durch einen Hinweis ersetzt.</p>
      </Modal>
    </div>
  )
}
