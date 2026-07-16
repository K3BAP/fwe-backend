import { useState } from 'react'
import { Button, Modal, TextareaField, TextField } from '@/components/ui'
import type { FeedPost, FeedPostCreateInput } from '@/api/schemas'

/**
 * Modal zum Verfassen/Bearbeiten eines Feed-Beitrags. Der Parent erzwingt per `key` einen Remount
 * pro Öffnung, damit Titel/Inhalt aus `initial` frisch übernommen werden.
 */
export function FeedComposer({
  open,
  onClose,
  onSubmit,
  submitting,
  initial,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (input: FeedPostCreateInput) => void
  submitting: boolean
  initial?: FeedPost | null
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Beitrag bearbeiten' : 'Beitrag verfassen'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            disabled={submitting || !body.trim()}
            onClick={() => onSubmit({ title: title.trim() || null, body: body.trim() })}
          >
            {initial ? 'Speichern' : 'Veröffentlichen'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField label="Titel (optional)" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Überschrift…" />
        <TextareaField label="Inhalt" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Was möchtest du mit der Gruppe teilen?" />
      </div>
    </Modal>
  )
}
