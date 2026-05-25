import { useState } from 'react'
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner'
import { AnimatePresence, motion } from 'motion/react'
import { useAdminTasks, useOnsiteSubmit, useRallyes } from '../../api/admin'
import type { TaskType } from '../../api/types'
import { ONSITE_TYPES } from '../../lib/taskTypes'
import { ApiError } from '../../api/client'
import { Button, Card, ErrorText, Input, Label, Skeleton } from '../../components/ui'
import { spring } from '../../lib/motion'

const selectClass =
  'w-full rounded-xl border border-line bg-surface px-4 py-3 text-fg outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'

export default function ScannerPage() {
  const { data: rallyes, isLoading } = useRallyes()
  const [rallyeId, setRallyeId] = useState<number | null>(null)
  const [taskId, setTaskId] = useState<number | null>(null)
  const [taskType, setTaskType] = useState<TaskType | null>(null)

  const { data: tasks } = useAdminTasks(rallyeId ?? 0)
  const onsiteTasks = (tasks ?? []).filter((t) => ONSITE_TYPES.includes(t.type))

  const [scannedToken, setScannedToken] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const submit = useOnsiteSubmit()

  if (isLoading) return <Skeleton className="h-40 w-full" />

  const onScan = (codes: IDetectedBarcode[]) => {
    const raw = codes[0]?.rawValue
    if (raw) {
      setScannedToken(raw)
      setError('')
      setResult('')
    }
  }

  const sendResult = async () => {
    if (!scannedToken || !taskId || value === '') return
    setError('')
    try {
      const res = await submit.mutateAsync({ token: scannedToken, task_id: taskId, value: Number(value) })
      setResult(`Eingetragen für Team „${res.team_name}".`)
      setScannedToken(null)
      setValue('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Eintrag fehlgeschlagen.')
    }
  }

  const activeTask = onsiteTasks.find((t) => Number(t.id) === taskId)

  return (
    <div className="mx-auto max-w-md space-y-5">
      <h1 className="text-2xl font-bold text-fg">On-Site Scanner</h1>

      <Card className="space-y-3">
        <div>
          <Label>Rallye</Label>
          <select
            value={rallyeId ?? ''}
            onChange={(e) => {
              setRallyeId(Number(e.target.value) || null)
              setTaskId(null)
              setTaskType(null)
            }}
            className={selectClass}
          >
            <option value="">– wählen –</option>
            {rallyes?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </div>

        {rallyeId && (
          <div>
            <Label>Aufgabe (vor Ort)</Label>
            <select
              value={taskId ?? ''}
              onChange={(e) => {
                const t = onsiteTasks.find((x) => Number(x.id) === Number(e.target.value))
                setTaskId(t ? Number(t.id) : null)
                setTaskType(t?.type ?? null)
              }}
              className={selectClass}
            >
              <option value="">– wählen –</option>
              {onsiteTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            {onsiteTasks.length === 0 && (
              <p className="mt-1 text-xs text-muted">Diese Rallye hat keine On-Site-Aufgaben.</p>
            )}
          </div>
        )}
      </Card>

      {taskId && !scannedToken && (
        <Card className="space-y-2">
          <p className="text-sm text-muted">Scanne den QR-Code des Teams.</p>
          <div className="overflow-hidden rounded-xl">
            <Scanner onScan={onScan} components={{ finder: true }} />
          </div>
        </Card>
      )}

      <AnimatePresence>
        {scannedToken && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={spring}>
            <Card className="space-y-3">
              <div>
                <Label>{taskType === 'onsite_time' ? 'Zeit in Sekunden' : 'Erreichte Punkte'}</Label>
                <Input type="number" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
                {activeTask && taskType === 'onsite_points' && (
                  <p className="mt-1 text-xs text-muted">Max. {activeTask.max_points} Punkte.</p>
                )}
              </div>
              <ErrorText>{error}</ErrorText>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setScannedToken(null)}>
                  Erneut scannen
                </Button>
                <Button onClick={sendResult} loading={submit.isPending} disabled={value === ''}>
                  Eintragen
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={spring}>
            <Card className="bg-green-50 text-center font-medium text-green-800 ring-green-200 dark:bg-green-500/15 dark:text-green-300 dark:ring-green-500/30">
              {result}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      <ErrorText>{!scannedToken ? error : ''}</ErrorText>
    </div>
  )
}
