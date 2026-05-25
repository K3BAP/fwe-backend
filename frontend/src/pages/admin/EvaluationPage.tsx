import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useEvaluate, usePending } from '../../api/admin'
import type { PendingSubmission } from '../../api/types'
import { Badge, Button, Card, Input, Skeleton } from '../../components/ui'
import { spring } from '../../lib/motion'

export default function EvaluationPage() {
  const { id } = useParams<{ id: string }>()
  const rallyeId = Number(id)
  const { data: pending, isLoading } = usePending(rallyeId)

  return (
    <div className="space-y-5">
      <Link to="/admin" className="text-sm font-medium text-brand-600 dark:text-brand-300">
        ← Alle Rallyes
      </Link>
      <h1 className="text-2xl font-bold text-fg">Offene Bewertungen</h1>

      {isLoading && <Skeleton className="h-32 w-full" />}
      {pending?.length === 0 && (
        <Card className="text-center text-muted">Keine offenen Bewertungen. Alles erledigt! 🎉</Card>
      )}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {pending?.map((sub) => (
            <motion.div
              key={sub.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              transition={spring}
            >
              <EvalCard sub={sub} rallyeId={rallyeId} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function EvalCard({ sub, rallyeId }: { sub: PendingSubmission; rallyeId: number }) {
  const evaluate = useEvaluate(rallyeId)
  const [points, setPoints] = useState(sub.task_max_points.toString())

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-fg">{sub.task_title}</p>
          <p className="text-sm text-muted">Team: {sub.team_name}</p>
        </div>
        <Badge tone="amber">max. {sub.task_max_points} Pkt.</Badge>
      </div>

      {sub.answer_text && <p className="rounded-lg bg-surface-2 p-3 text-fg">„{sub.answer_text}"</p>}
      {sub.photo_url && (
        <a href={sub.photo_url} target="_blank" rel="noreferrer">
          <img src={sub.photo_url} alt="Abgabe" className="max-h-72 w-full rounded-lg object-contain" />
        </a>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={sub.task_max_points}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            className="w-24"
          />
          <Button
            loading={evaluate.isPending}
            onClick={() => evaluate.mutate({ id: sub.id, correct: true, points: Number(points) })}
          >
            Akzeptieren
          </Button>
        </div>
        <Button variant="danger" disabled={evaluate.isPending} onClick={() => evaluate.mutate({ id: sub.id, correct: false })}>
          Ablehnen
        </Button>
      </div>
    </Card>
  )
}
