import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { AnimatePresence, motion } from 'motion/react'
import { useMe, useSubmit, useTasks, useUploadPhoto } from '../../api/participant'
import { useSession } from '../../store/session'
import { ApiError } from '../../api/client'
import { getCurrentPosition } from '../../lib/geo'
import { TASK_TYPE_HINT, TASK_TYPE_LABEL } from '../../lib/taskTypes'
import type { ParticipantTask } from '../../api/types'
import { Badge, Button, Card, ErrorText, Input, Label, Spinner, Textarea } from '../../components/ui'
import { spring } from '../../lib/motion'

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
      <button onClick={() => navigate('/rallye')} className="text-sm font-medium text-brand-600 dark:text-brand-300">
        ← Alle Stationen
      </button>

      <div>
        <Badge tone="indigo">{TASK_TYPE_LABEL[task.type]}</Badge>
        <h1 className="mt-2 text-xl font-bold text-fg">{task.title}</h1>
        {task.prompt && <p className="mt-1 whitespace-pre-line text-fg">{task.prompt}</p>}
        <p className="mt-1 text-xs text-muted">
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
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={spring}>
      <Card className="text-center">
        <Badge tone={map.tone} pulse={sub.status === 'pending'}>
          {map.text}
        </Badge>
        {sub.status !== 'pending' && (
          <motion.p
            className="mt-3 text-3xl font-bold text-fg"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...spring, delay: 0.1 }}
          >
            {sub.points ?? 0} <span className="text-base font-medium text-muted">/ {task.max_points} Pkt.</span>
          </motion.p>
        )}
        {sub.answer_text && <p className="mt-2 text-sm text-muted">Deine Antwort: {sub.answer_text}</p>}
        {sub.answer_number !== null && <p className="mt-2 text-sm text-muted">Deine Schätzung: {sub.answer_number}</p>}
      </Card>
    </motion.div>
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

/** Schüttel-Animation bei neuem Fehler. */
function ShakeError({ children }: { children: string }) {
  return (
    <AnimatePresence mode="wait">
      {children ? (
        <motion.div
          key={children}
          initial={{ x: 0 }}
          animate={{ x: [0, -8, 8, -5, 5, 0] }}
          transition={{ duration: 0.4 }}
        >
          <ErrorText>{children}</ErrorText>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
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
        <motion.button
          key={i}
          whileTap={{ scale: 0.98 }}
          onClick={() => setChoice(i)}
          className={`w-full rounded-xl border px-4 py-3 text-left text-base transition-colors ${
            choice === i
              ? 'border-brand-500 bg-brand-50 font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-200'
              : 'border-line text-fg'
          }`}
        >
          {opt}
        </motion.button>
      ))}
      <ShakeError>{error}</ShakeError>
      <Button className="w-full" loading={pending} disabled={choice === null} onClick={() => run({ answer_choice: choice })}>
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
      <ShakeError>{error}</ShakeError>
      <Button className="w-full" loading={pending} disabled={!value.trim()} onClick={() => run({ answer_text: value.trim() })}>
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
      <ShakeError>{error}</ShakeError>
      <Button className="w-full" loading={pending} disabled={value === ''} onClick={() => run({ answer_number: Number(value) })}>
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
        className="w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-medium file:text-fg"
      />
      <ShakeError>{error}</ShakeError>
      <Button className="w-full" loading={upload.isPending} disabled={!file} onClick={submit}>
        Foto hochladen
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
      <p className="text-fg">Bist du am richtigen Ort? Dann checke jetzt ein.</p>
      <ShakeError>{geoError || error}</ShakeError>
      <Button className="w-full" loading={pending || busy} onClick={checkin}>
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
          <p className="text-fg">Zeige diesen QR-Code der Aufsicht vor Ort.</p>
          <motion.div
            className="rounded-xl bg-white p-4 ring-1 ring-slate-200"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={spring}
          >
            <QRCodeSVG value={token ?? ''} size={220} />
          </motion.div>
          <p className="text-xs text-muted">
            {task.type === 'onsite_time' ? 'Die Aufsicht trägt eure Zeit ein.' : 'Die Aufsicht trägt eure Punkte ein.'}
          </p>
        </Card>
      )}
    </div>
  )
}
