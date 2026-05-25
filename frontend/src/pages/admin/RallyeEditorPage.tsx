import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  useAdminTasks,
  useDeleteTask,
  useRallye,
  useReorderTasks,
  useSaveRallye,
  useSaveTask,
  type TaskInput,
} from '../../api/admin'
import type { AdminTask, Rallye, TaskType } from '../../api/types'
import { TASK_TYPE_LABEL } from '../../lib/taskTypes'
import { ApiError } from '../../api/client'
import { AnimatePresence, motion, Reorder, useDragControls } from 'motion/react'
import { Badge, Button, Card, ErrorText, Input, Label, Skeleton, Textarea } from '../../components/ui'
import { GpsTaskMap } from '../../components/GpsTaskMap'
import { spring } from '../../lib/motion'

export default function RallyeEditorPage() {
  const { id } = useParams<{ id: string }>()
  const rallyeId = Number(id)
  const { data: rallye, isLoading } = useRallye(rallyeId)

  if (isLoading || !rallye) return <Skeleton className="h-64 w-full" />

  return (
    <div className="space-y-6">
      <Link to="/admin" className="text-sm font-medium text-brand-600 dark:text-brand-300">
        ← Alle Rallyes
      </Link>
      <SettingsForm rallye={rallye} />
      <TasksSection rallyeId={rallyeId} />
    </div>
  )
}

function SettingsForm({ rallye }: { rallye: Rallye }) {
  const save = useSaveRallye()
  const [form, setForm] = useState({
    title: rallye.title,
    theme: rallye.theme ?? '',
    description: rallye.description ?? '',
    join_code: rallye.join_code,
    teams_enabled: rallye.teams_enabled,
    max_team_size: rallye.max_team_size?.toString() ?? '',
    preset_team_count: rallye.preset_team_count?.toString() ?? '',
  })
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    setMsg('')
    try {
      await save.mutateAsync({
        id: rallye.id,
        data: {
          title: form.title,
          theme: form.theme,
          description: form.description,
          join_code: form.join_code,
          teams_enabled: form.teams_enabled,
          max_team_size: form.max_team_size ? Number(form.max_team_size) : null,
          preset_team_count: form.preset_team_count ? Number(form.preset_team_count) : null,
        },
      })
      setMsg('Gespeichert.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen.')
    }
  }

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-bold text-fg">Einstellungen</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Titel</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <Label>Motto / Thema</Label>
          <Input value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Beschreibung</Label>
        <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div>
        <Label>Beitritts-Code (für Link & QR)</Label>
        <Input value={form.join_code} onChange={(e) => setForm({ ...form, join_code: e.target.value })} />
      </div>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={form.teams_enabled}
          onChange={(e) => setForm({ ...form, teams_enabled: e.target.checked })}
          className="h-5 w-5 accent-brand-600"
        />
        <span className="font-medium text-fg">Teams erlauben</span>
      </label>

      {form.teams_enabled && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Max. Teamgröße (leer = unbegrenzt)</Label>
            <Input
              type="number"
              min={1}
              value={form.max_team_size}
              onChange={(e) => setForm({ ...form, max_team_size: e.target.value })}
            />
          </div>
          <div>
            <Label>Feste Teamanzahl (leer = frei)</Label>
            <Input
              type="number"
              min={1}
              value={form.preset_team_count}
              onChange={(e) => setForm({ ...form, preset_team_count: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted">
              Hinweis: Bei fester Anzahl können Teilnehmer keine eigenen Teams gründen.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={submit} loading={save.isPending}>
          Speichern
        </Button>
        <AnimatePresence>
          {msg && (
            <motion.span
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm font-medium text-green-600 dark:text-green-400"
            >
              {msg}
            </motion.span>
          )}
        </AnimatePresence>
        <ErrorText>{error}</ErrorText>
      </div>
    </Card>
  )
}

function TasksSection({ rallyeId }: { rallyeId: number }) {
  const { data: tasks, isLoading } = useAdminTasks(rallyeId)
  const del = useDeleteTask(rallyeId)
  const reorder = useReorderTasks(rallyeId)
  const [editing, setEditing] = useState<AdminTask | 'new' | null>(null)
  const [order, setOrder] = useState<AdminTask[]>(tasks ?? [])
  const [prevTasks, setPrevTasks] = useState(tasks)

  if (tasks !== prevTasks) {
    setPrevTasks(tasks)
    setOrder(tasks ?? [])
  }

  const handleReorder = (next: AdminTask[]) => {
    setOrder(next)
    reorder.mutate(next.map((t) => t.id))
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-fg">Stationen / Aufgaben</h2>
        <Button onClick={() => setEditing('new')}>+ Aufgabe</Button>
      </div>

      {isLoading && <Skeleton className="h-16 w-full" />}
      <Reorder.Group axis="y" values={order} onReorder={handleReorder} className="space-y-2">
        {order.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onEdit={() => setEditing(task)}
            onDelete={() => confirm('Aufgabe löschen?') && del.mutate(task.id)}
          />
        ))}
      </Reorder.Group>
      {order.length === 0 && !isLoading && <p className="text-muted">Noch keine Aufgaben.</p>}

      <AnimatePresence>
        {editing && (
          <TaskEditor rallyeId={rallyeId} task={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
        )}
      </AnimatePresence>
    </Card>
  )
}

function TaskRow({
  task,
  onEdit,
  onDelete,
}: {
  task: AdminTask
  onEdit: () => void
  onDelete: () => void
}) {
  const dragControls = useDragControls()
  return (
    <Reorder.Item
      value={task}
      dragListener={false}
      dragControls={dragControls}
      className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <span
          onPointerDown={(e) => dragControls.start(e)}
          className="cursor-grab touch-none select-none px-1 text-muted active:cursor-grabbing"
          aria-label="Verschieben"
        >
          ⠿
        </span>
        <div>
          <p className="font-semibold text-fg">{task.title}</p>
          <p className="text-xs text-muted">
            <Badge tone="indigo">{TASK_TYPE_LABEL[task.type]}</Badge> · {task.max_points} Pkt.
          </p>
        </div>
      </div>
      <div className="flex gap-3 text-sm font-medium">
        <button onClick={onEdit} className="text-brand-600 hover:underline dark:text-brand-300">
          Bearbeiten
        </button>
        <button onClick={onDelete} className="text-red-600 hover:underline dark:text-red-400">
          Löschen
        </button>
      </div>
    </Reorder.Item>
  )
}

const ALL_TYPES: TaskType[] = [
  'multiple_choice',
  'exact_text',
  'numeric_estimate',
  'free_text',
  'photo_upload',
  'gps_checkin',
  'onsite_time',
  'onsite_points',
]

function TaskEditor({
  rallyeId,
  task,
  onClose,
}: {
  rallyeId: number
  task: AdminTask | null
  onClose: () => void
}) {
  const save = useSaveTask(rallyeId)
  const [error, setError] = useState('')
  const [type, setType] = useState<TaskType>(task?.type ?? 'multiple_choice')
  const [title, setTitle] = useState(task?.title ?? '')
  const [prompt, setPrompt] = useState(task?.prompt ?? '')
  const [maxPoints, setMaxPoints] = useState((task?.max_points ?? 10).toString())

  // config-Felder
  const [choices, setChoices] = useState<string[]>(task?.config.choices ?? ['', ''])
  const [correctIndex, setCorrectIndex] = useState(task?.config.correct_index ?? 0)
  const [accepted, setAccepted] = useState<string[]>(task?.config.accepted ?? [''])
  const [samples, setSamples] = useState<string[]>(task?.config.sample_solutions ?? [''])
  const [target, setTarget] = useState(task?.config.target?.toString() ?? '')
  const [lat, setLat] = useState(task?.config.lat?.toString() ?? '')
  const [lng, setLng] = useState(task?.config.lng?.toString() ?? '')
  const [radius, setRadius] = useState(task?.config.radius_m?.toString() ?? '50')

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const buildConfig = () => {
    switch (type) {
      case 'multiple_choice':
        return { choices: choices.map((c) => c.trim()).filter(Boolean), correct_index: correctIndex }
      case 'exact_text':
        return { accepted: accepted.map((c) => c.trim()).filter(Boolean) }
      case 'free_text':
        return { sample_solutions: samples.map((c) => c.trim()).filter(Boolean) }
      case 'numeric_estimate':
        return { target: Number(target), tolerance: 0 }
      case 'gps_checkin':
        return { lat: Number(lat), lng: Number(lng), radius_m: Number(radius) }
      default:
        return {}
    }
  }

  const submit = async () => {
    setError('')
    const data: TaskInput = {
      type,
      title: title.trim(),
      prompt: prompt.trim(),
      max_points: Number(maxPoints) || 0,
      config: buildConfig(),
    }
    try {
      await save.mutateAsync({ id: task?.id, data })
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen.')
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="my-8 w-full max-w-lg space-y-4 rounded-2xl bg-surface p-6 shadow-lift ring-1 ring-line"
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={spring}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-fg">{task ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</h3>

        <div>
          <Label>Aufgabentyp</Label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TaskType)}
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-fg outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
          >
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>
                {TASK_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label>Titel</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>Aufgabentext</Label>
          <Textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </div>
        <div>
          <Label>Max. Punkte</Label>
          <Input type="number" value={maxPoints} onChange={(e) => setMaxPoints(e.target.value)} />
        </div>

        {/* Typspezifische Konfiguration */}
        {type === 'multiple_choice' && (
          <div>
            <Label>Antwortoptionen (richtige markieren)</Label>
            {choices.map((c, i) => (
              <div key={i} className="mb-2 flex items-center gap-2">
                <input type="radio" checked={correctIndex === i} onChange={() => setCorrectIndex(i)} className="h-5 w-5 accent-brand-600" />
                <Input value={c} onChange={(e) => setChoices(choices.map((x, j) => (j === i ? e.target.value : x)))} />
                {choices.length > 2 && (
                  <button onClick={() => setChoices(choices.filter((_, j) => j !== i))} className="text-red-500 dark:text-red-400">
                    ✕
                  </button>
                )}
              </div>
            ))}
            <Button variant="ghost" onClick={() => setChoices([...choices, ''])}>
              + Option
            </Button>
          </div>
        )}

        {type === 'exact_text' && (
          <StringList label="Akzeptierte Antworten" values={accepted} onChange={setAccepted} />
        )}
        {type === 'free_text' && (
          <StringList label="Musterlösungen (automatisch korrekt)" values={samples} onChange={setSamples} />
        )}

        {type === 'numeric_estimate' && (
          <div>
            <Label>Zielwert (richtige Zahl)</Label>
            <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
        )}

        {type === 'gps_checkin' && (
          <div className="space-y-3">
            <Label>Standort</Label>
            <GpsTaskMap
              lat={lat === '' ? null : Number(lat)}
              lng={lng === '' ? null : Number(lng)}
              radiusM={Number(radius) || 50}
              onChange={({ lat, lng }) => {
                setLat(lat.toFixed(6))
                setLng(lng.toFixed(6))
              }}
            />
            <p className="text-sm text-muted">
              {lat && lng ? `Gewählt: ${lat}, ${lng}` : 'Tippe auf die Karte, um den Punkt zu setzen.'}
            </p>
            <div>
              <Label>Radius: {radius || 50} m</Label>
              <input
                type="range"
                min={5}
                max={500}
                step={5}
                value={radius || 50}
                onChange={(e) => setRadius(e.target.value)}
                className="w-full accent-brand-600"
              />
            </div>
          </div>
        )}

        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            Speichern
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function StringList({
  label,
  values,
  onChange,
}: {
  label: string
  values: string[]
  onChange: (v: string[]) => void
}) {
  return (
    <div>
      <Label>{label}</Label>
      {values.map((v, i) => (
        <div key={i} className="mb-2 flex items-center gap-2">
          <Input value={v} onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))} />
          {values.length > 1 && (
            <button onClick={() => onChange(values.filter((_, j) => j !== i))} className="text-red-500 dark:text-red-400">
              ✕
            </button>
          )}
        </div>
      ))}
      <Button variant="ghost" onClick={() => onChange([...values, ''])}>
        + Hinzufügen
      </Button>
    </div>
  )
}
