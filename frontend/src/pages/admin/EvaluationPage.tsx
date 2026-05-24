import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useEvaluate, usePending } from '../../api/admin'
import type { PendingSubmission } from '../../api/types'
import { Badge, Button, Card, Input, Spinner } from '../../components/ui'

export default function EvaluationPage() {
  const { id } = useParams<{ id: string }>()
  const rallyeId = Number(id)
  const { data: pending, isLoading } = usePending(rallyeId)

  return (
    <div className="space-y-5">
      <Link to="/admin" className="text-sm font-medium text-indigo-600">
        ← Alle Rallyes
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">Offene Bewertungen</h1>

      {isLoading && <Spinner />}
      {pending?.length === 0 && (
        <Card className="text-center text-slate-500">Keine offenen Bewertungen. Alles erledigt! 🎉</Card>
      )}
      <div className="space-y-3">
        {pending?.map((sub) => <EvalCard key={sub.id} sub={sub} rallyeId={rallyeId} />)}
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
          <p className="font-semibold text-slate-900">{sub.task_title}</p>
          <p className="text-sm text-slate-500">Team: {sub.team_name}</p>
        </div>
        <Badge tone="amber">max. {sub.task_max_points} Pkt.</Badge>
      </div>

      {sub.answer_text && (
        <p className="rounded-lg bg-slate-50 p-3 text-slate-800">„{sub.answer_text}"</p>
      )}
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
            disabled={evaluate.isPending}
            onClick={() => evaluate.mutate({ id: sub.id, correct: true, points: Number(points) })}
          >
            Akzeptieren
          </Button>
        </div>
        <Button
          variant="danger"
          disabled={evaluate.isPending}
          onClick={() => evaluate.mutate({ id: sub.id, correct: false })}
        >
          Ablehnen
        </Button>
      </div>
    </Card>
  )
}
