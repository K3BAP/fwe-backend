import { useState } from 'react'
import { Button, Modal, TextField } from '@/components/ui'

/** Modal zum Erstellen/Umbenennen eines Channels. Parent erzwingt Remount via `key`. */
export function ChannelDialog({
  open,
  onClose,
  onSubmit,
  submitting,
  initialName,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (name: string) => void
  submitting: boolean
  initialName?: string
}) {
  const editing = initialName != null
  const [name, setName] = useState(initialName ?? '')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Channel umbenennen' : 'Channel erstellen'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button disabled={submitting || !name.trim()} onClick={() => onSubmit(name.trim())}>
            {editing ? 'Speichern' : 'Erstellen'}
          </Button>
        </>
      }
    >
      <TextField label="Channel-Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Wetter & Bedingungen" />
    </Modal>
  )
}
