import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { AnimatePresence, motion } from 'motion/react'
import { useParticipants, useReissue } from '../../api/admin'
import { Badge, Button, Card, Skeleton } from '../../components/ui'
import { Item, Stagger } from '../../components/motion'

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
      <Link to="/admin" className="text-sm font-medium text-brand-600 dark:text-brand-300">
        ← Alle Rallyes
      </Link>
      <h1 className="text-2xl font-bold text-fg">Teilnehmer</h1>

      {isLoading && <Skeleton className="h-20 w-full" />}
      <Stagger className="space-y-2">
        {participants?.map((p) => (
          <Item key={p.id}>
            <Card className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-fg">{p.display_name}</p>
                  {p.team_name ? <Badge tone="indigo">{p.team_name}</Badge> : <Badge tone="gray">Kein Team</Badge>}
                </div>
                <Button variant="secondary" loading={reissue.isPending} onClick={() => makeLink(p.id)}>
                  Login-Link
                </Button>
              </div>
              <AnimatePresence initial={false}>
                {links[p.id] && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-lg bg-surface-2 p-3">
                      <p className="text-xs text-muted">QR-Code scannen lassen oder Link senden:</p>
                      <div className="mt-2 flex justify-center">
                        <QRCodeSVG value={links[p.id]} size={180} className="rounded bg-white p-2" />
                      </div>
                      <code className="mt-2 block break-all text-xs text-brand-600 dark:text-brand-300">{links[p.id]}</code>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </Item>
        ))}
        {participants?.length === 0 && <p className="text-muted">Noch keine Teilnehmer.</p>}
      </Stagger>
    </div>
  )
}
