import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useMe, useSubmit, useTasks, useUploadPhoto } from '../../api/participant'
import { useSession } from '../../store/session'
import { ApiError } from '../../api/client'
import { getCurrentPosition } from '../../lib/geo'
import { TASK_TYPE_HINT, TASK_TYPE_LABEL } from '../../lib/taskTypes'
import type { ParticipantTask } from '../../api/types'
import { Badge, Button, Card, ErrorText, Input, Label, Spinner, Textarea } from '../../components/ui'

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const taskId = Number(id)
  const navigate = useNavigate()
  const { data: me } = useMe()
  const { data: tasks } = useTasks(me?.rallye.id)
  const task = tasks?.find((t) => t.id === taskId)

  if (!task) return <Spinner />

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/rallye')} className="text-sm font-medium text-indigo-600">
        ← Alle Stationen
      </button>

      <div>
        <Badge tone="indigo">{TASK_TYPE_LABEL[task.type]}</Badge>
        <h1 className="mt-2 text-xl font-bold text-slate-900">{task.title}</h1>
        {task.prompt && <p className="mt-1 whitespace-pre-line text-slate-700">{task.prompt}</p>}
        <p className="mt-1 text-xs text-slate-500">
          Max. {task.max_points} Punkte · {TASK_TYPE_HINT[task.type]}
        </p>
      </div>

      <TaskBody task={task} />
    </div>
  )
}

function ResultCard({ task }: { task: ParticipantTask }) {
  const sub = task.submission!
  const map = {
    correct: { tone: 'green' as const, text: 'Richtig gelöst!' },
    incorrect: { tone: 'red' as const, text: 'Leider falsch.' },
    evaluated: { tone: 'indigo' as const, text: 'Bewertet.' },
    pending: { tone: 'amber' as const, text: 'Deine Antwort wird von der Spielleitung geprüft.' },
  }[sub.status]

  return (
    <Card className="text-center">
      <Badge tone={map.tone}>{map.text}</Badge>
      {sub.status !== 'pending' && (
        <p className="mt-3 text-3xl font-bold text-slate-900">
          {sub.points ?? 0} <span className="text-base font-medium text-slate-500">/ {task.max_points} Pkt.</span>
        </p>
      )}
      {sub.answer_text && <p className="mt-2 text-sm text-slate-500">Deine Antwort: {sub.answer_text}</p>}
      {sub.answer_number !== null && <p className="mt-2 text-sm text-slate-500">Deine Schätzung: {sub.answer_number}</p>}
    </Card>
  )
}

function TaskBody({ task }: { task: ParticipantTask }) {
  // On-Site-Aufgaben: QR-Code zeigen (auch nach Eintrag das Ergebnis).
  if (task.type === 'onsite_time' || task.type === 'onsite_points') {
    return <OnsiteTask task={task} />
  }

  // Bereits abgegeben -> Ergebnis (unveränderlich).
  if (task.submission) return <ResultCard task={task} />

  switch (task.type) {
    case 'multiple_choice':
      return <MultipleChoice task={task} />
    case 'exact_text':
      return <TextAnswer task={task} kind="exact" />
    case 'free_text':
      return <TextAnswer task={task} kind="free" />
    case 'numeric_estimate':
      return <NumericEstimate task={task} />
    case 'photo_upload':
      return <PhotoUpload task={task} />
    case 'gps_checkin':
      return <GpsCheckin task={task} />
    default:
      return null
  }
}

function useSubmitHandler(taskId: number) {
  const submit = useSubmit(taskId)
  const [error, setError] = useState('')
  const run = async (body: Record<string, unknown>) => {
    setError('')
    try {
      await submit.mutateAsync(body)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Abgabe fehlgeschlagen.')
    }
  }
  return { run, error, pending: submit.isPending }
}

function MultipleChoice({ task }: { task: ParticipantTask }) {
  const [choice, setChoice] = useState<number | null>(null)
  const { run, error, pending } = useSubmitHandler(task.id)
  return (
    <Card className="space-y-3">
      {(task.options ?? []).map((opt, i) => (
        <button
          key={i}
          onClick={() => setChoice(i)}
          className={`w-full rounded-xl border px-4 py-3 text-left text-base ${
            choice === i ? 'border-indigo-500 bg-indigo-50 font-semibold' : 'border-slate-300'
          }`}
        >
          {opt}
        </button>
      ))}
      <ErrorText>{error}</ErrorText>
      <Button className="w-full" disabled={choice === null || pending} onClick={() => run({ answer_choice: choice })}>
        Antwort abgeben
      </Button>
    </Card>
  )
}

function TextAnswer({ task, kind }: { task: ParticipantTask; kind: 'exact' | 'free' }) {
  const [value, setValue] = useState('')
  const { run, error, pending } = useSubmitHandler(task.id)
  return (
    <Card className="space-y-3">
      <Label>Deine Antwort</Label>
      {kind === 'free' ? (
        <Textarea rows={4} value={value} onChange={(e) => setValue(e.target.value)} />
      ) : (
        <Input value={value} onChange={(e) => setValue(e.target.value)} />
      )}
      <ErrorText>{error}</ErrorText>
      <Button className="w-full" disabled={!value.trim() || pending} onClick={() => run({ answer_text: value.trim() })}>
        Antwort abgeben
      </Button>
    </Card>
  )
}

function NumericEstimate({ task }: { task: ParticipantTask }) {
  const [value, setValue] = useState('')
  const { run, error, pending } = useSubmitHandler(task.id)
  return (
    <Card className="space-y-3">
      <Label>Deine Schätzung</Label>
      <Input type="number" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
      <ErrorText>{error}</ErrorText>
      <Button
        className="w-full"
        disabled={value === '' || pending}
        onClick={() => run({ answer_number: Number(value) })}
      >
        Schätzung abgeben
      </Button>
    </Card>
  )
}

function PhotoUpload({ task }: { task: ParticipantTask }) {
  const upload = useUploadPhoto(task.id)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const submit = async () => {
    if (!file) return
    setError('')
    try {
      await upload.mutateAsync(file)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload fehlgeschlagen.')
    }
  }
  return (
    <Card className="space-y-3">
      <Label>Foto auswählen</Label>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="w-full text-sm"
      />
      <ErrorText>{error}</ErrorText>
      <Button className="w-full" disabled={!file || upload.isPending} onClick={submit}>
        {upload.isPending ? 'Lädt hoch…' : 'Foto hochladen'}
      </Button>
    </Card>
  )
}

function GpsCheckin({ task }: { task: ParticipantTask }) {
  const { run, error, pending } = useSubmitHandler(task.id)
  const [geoError, setGeoError] = useState('')
  const [busy, setBusy] = useState(false)
  const checkin = async () => {
    setGeoError('')
    setBusy(true)
    try {
      const pos = await getCurrentPosition()
      await run({ lat: pos.lat, lng: pos.lng })
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : 'Standortfehler.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="space-y-3 text-center">
      <p className="text-slate-600">Bist du am richtigen Ort? Dann checke jetzt ein.</p>
      <ErrorText>{geoError || error}</ErrorText>
      <Button className="w-full" disabled={pending || busy} onClick={checkin}>
        {busy || pending ? 'Prüfe Standort…' : 'Hier einchecken'}
      </Button>
    </Card>
  )
}

function OnsiteTask({ task }: { task: ParticipantTask }) {
  const token = useSession((s) => s.token)
  return (
    <div className="space-y-4">
      {task.submission && task.submission.status !== 'pending' ? (
        <ResultCard task={task} />
      ) : (
        <Card className="flex flex-col items-center gap-3 text-center">
          <p className="text-slate-700">Zeige diesen QR-Code der Aufsicht vor Ort.</p>
          <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <QRCodeSVG value={token ?? ''} size={220} />
          </div>
          <p className="text-xs text-slate-500">
            {task.type === 'onsite_time'
              ? 'Die Aufsicht trägt eure Zeit ein.'
              : 'Die Aufsicht trägt eure Punkte ein.'}
          </p>
        </Card>
      )}
    </div>
  )
}
