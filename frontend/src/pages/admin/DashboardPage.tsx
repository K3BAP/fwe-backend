import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { AnimatePresence, motion } from 'motion/react'
import { useDeleteRallye, useRallyes, useSaveRallye, useSetStatus } from '../../api/admin'
import type { Rallye, RallyeStatus } from '../../api/types'
import { Badge, Button, Card, Skeleton } from '../../components/ui'
import { Item, Stagger } from '../../components/motion'

const STATUS_LABEL: Record<RallyeStatus, string> = {
  draft: 'Entwurf',
  active: 'Aktiv',
  finished: 'Beendet',
}
const STATUS_TONE: Record<RallyeStatus, 'gray' | 'green' | 'indigo'> = {
  draft: 'gray',
  active: 'green',
  finished: 'indigo',
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data: rallyes, isLoading } = useRallyes()
  const save = useSaveRallye()

  const createRallye = async () => {
    const res = await save.mutateAsync({ data: { title: 'Neue Rallye', teams_enabled: true } })
    navigate(`/admin/rallye/${res.rallye.id}`)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fg">Rallyes</h1>
        <Button onClick={createRallye} loading={save.isPending}>
          + Neue Rallye
        </Button>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}
      <Stagger className="grid gap-4 md:grid-cols-2">
        <AnimatePresence>
          {rallyes?.map((r) => (
            <Item key={r.id}>
              <RallyeCard rallye={r} />
            </Item>
          ))}
        </AnimatePresence>
      </Stagger>
      {rallyes?.length === 0 && <p className="text-muted">Noch keine Rallyes. Erstelle deine erste!</p>}
    </div>
  )
}

function RallyeCard({ rallye }: { rallye: Rallye }) {
  const setStatus = useSetStatus()
  const del = useDeleteRallye()
  const [showQr, setShowQr] = useState(false)
  const [copied, setCopied] = useState(false)

  const joinUrl = `${window.location.origin}${import.meta.env.BASE_URL}r/${rallye.join_code}`

  const copy = async () => {
    await navigator.clipboard.writeText(joinUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-bold text-fg">{rallye.title}</h2>
          {rallye.theme && <p className="text-sm text-muted">{rallye.theme}</p>}
        </div>
        <Badge tone={STATUS_TONE[rallye.status]}>{STATUS_LABEL[rallye.status]}</Badge>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <button onClick={copy} className="rounded-lg bg-surface-2 px-3 py-1.5 font-medium text-fg transition-colors hover:bg-line">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={copied ? 'copied' : 'copy'}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="inline-block"
            >
              {copied ? '✓ Kopiert!' : 'Link kopieren'}
            </motion.span>
          </AnimatePresence>
        </button>
        <button
          onClick={() => setShowQr((v) => !v)}
          className="rounded-lg bg-surface-2 px-3 py-1.5 font-medium text-fg transition-colors hover:bg-line"
        >
          QR-Code
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showQr && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col items-center gap-2 rounded-xl bg-surface-2 p-4">
              <div className="rounded-lg bg-white p-2">
                <QRCodeSVG value={joinUrl} size={180} />
              </div>
              <code className="break-all text-xs text-muted">{joinUrl}</code>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap gap-2">
        {rallye.status === 'draft' && (
          <Button variant="secondary" onClick={() => setStatus.mutate({ id: rallye.id, status: 'active' })}>
            Starten
          </Button>
        )}
        {rallye.status === 'active' && (
          <Button variant="secondary" onClick={() => setStatus.mutate({ id: rallye.id, status: 'finished' })}>
            Beenden
          </Button>
        )}
        {rallye.status === 'finished' && (
          <Button variant="secondary" onClick={() => setStatus.mutate({ id: rallye.id, status: 'active' })}>
            Reaktivieren
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 border-t border-line pt-3 text-sm font-medium">
        <Link to={`/admin/rallye/${rallye.id}`} className="text-brand-600 hover:underline dark:text-brand-300">
          Bearbeiten
        </Link>
        <Link to={`/admin/rallye/${rallye.id}/evaluate`} className="text-brand-600 hover:underline dark:text-brand-300">
          Bewertung
        </Link>
        <Link to={`/admin/rallye/${rallye.id}/participants`} className="text-brand-600 hover:underline dark:text-brand-300">
          Teilnehmer
        </Link>
        <Link to={`/admin/rallye/${rallye.id}/leaderboard`} className="text-brand-600 hover:underline dark:text-brand-300">
          Rangliste
        </Link>
        <button
          onClick={() => {
            if (confirm(`Rallye „${rallye.title}" wirklich löschen?`)) del.mutate(rallye.id)
          }}
          className="ml-auto text-red-600 hover:underline dark:text-red-400"
        >
          Löschen
        </button>
      </div>
    </Card>
  )
}
