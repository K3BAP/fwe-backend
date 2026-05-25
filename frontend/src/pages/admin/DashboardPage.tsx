import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useDeleteRallye, useRallyes, useSaveRallye, useSetStatus } from '../../api/admin'
import type { Rallye, RallyeStatus } from '../../api/types'
import { Badge, Button, Card, Spinner } from '../../components/ui'

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
        <h1 className="text-2xl font-bold text-slate-900">Rallyes</h1>
        <Button onClick={createRallye} disabled={save.isPending}>
          + Neue Rallye
        </Button>
      </div>

      {isLoading && <Spinner />}
      <div className="grid gap-4 md:grid-cols-2">
        {rallyes?.map((r) => <RallyeCard key={r.id} rallye={r} />)}
      </div>
      {rallyes?.length === 0 && <p className="text-slate-500">Noch keine Rallyes. Erstelle deine erste!</p>}
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
          <h2 className="font-bold text-slate-900">{rallye.title}</h2>
          {rallye.theme && <p className="text-sm text-slate-500">{rallye.theme}</p>}
        </div>
        <Badge tone={STATUS_TONE[rallye.status]}>{STATUS_LABEL[rallye.status]}</Badge>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <button onClick={copy} className="rounded-lg bg-slate-100 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-200">
          {copied ? 'Kopiert!' : 'Link kopieren'}
        </button>
        <button onClick={() => setShowQr((v) => !v)} className="rounded-lg bg-slate-100 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-200">
          QR-Code
        </button>
      </div>

      {showQr && (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-slate-50 p-4">
          <QRCodeSVG value={joinUrl} size={180} />
          <code className="text-xs text-slate-500">{joinUrl}</code>
        </div>
      )}

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

      <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-sm font-medium">
        <Link to={`/admin/rallye/${rallye.id}`} className="text-indigo-600 hover:underline">
          Bearbeiten
        </Link>
        <Link to={`/admin/rallye/${rallye.id}/evaluate`} className="text-indigo-600 hover:underline">
          Bewertung
        </Link>
        <Link to={`/admin/rallye/${rallye.id}/participants`} className="text-indigo-600 hover:underline">
          Teilnehmer
        </Link>
        <Link to={`/admin/rallye/${rallye.id}/leaderboard`} className="text-indigo-600 hover:underline">
          Rangliste
        </Link>
        <button
          onClick={() => {
            if (confirm(`Rallye „${rallye.title}" wirklich löschen?`)) del.mutate(rallye.id)
          }}
          className="ml-auto text-red-600 hover:underline"
        >
          Löschen
        </button>
      </div>
    </Card>
  )
}
