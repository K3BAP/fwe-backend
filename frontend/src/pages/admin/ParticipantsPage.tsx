import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useParticipants, useReissue } from '../../api/admin'
import { Badge, Button, Card, Spinner } from '../../components/ui'

export default function ParticipantsPage() {
  const { id } = useParams<{ id: string }>()
  const rallyeId = Number(id)
  const { data: participants, isLoading } = useParticipants(rallyeId)
  const reissue = useReissue()
  const [links, setLinks] = useState<Record<number, string>>({})

  const makeLink = async (participantId: number) => {
    const res = await reissue.mutateAsync(participantId)
    const url = `${window.location.origin}${import.meta.env.BASE_URL}s/${res.token}`
    setLinks((prev) => ({ ...prev, [participantId]: url }))
    await navigator.clipboard.writeText(url).catch(() => {})
  }

  return (
    <div className="space-y-5">
      <Link to="/admin" className="text-sm font-medium text-indigo-600">
        ← Alle Rallyes
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">Teilnehmer</h1>

      {isLoading && <Spinner />}
      <div className="space-y-2">
        {participants?.map((p) => (
          <Card key={p.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">{p.display_name}</p>
                {p.team_name ? (
                  <Badge tone="indigo">{p.team_name}</Badge>
                ) : (
                  <Badge tone="gray">Kein Team</Badge>
                )}
              </div>
              <Button variant="secondary" disabled={reissue.isPending} onClick={() => makeLink(p.id)}>
                Login-Link
              </Button>
            </div>
            {links[p.id] && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">QR-Code scannen lassen oder Link senden:</p>
                <div className="mt-2 flex justify-center">
                  <QRCodeSVG value={links[p.id]} size={180} className="rounded bg-white p-2" />
                </div>
                <code className="mt-2 block break-all text-xs text-indigo-700">{links[p.id]}</code>
              </div>
            )}
          </Card>
        ))}
        {participants?.length === 0 && <p className="text-slate-500">Noch keine Teilnehmer.</p>}
      </div>
    </div>
  )
}
