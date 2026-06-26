import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { experienceLevelSchema, type MeetupCreateInput } from '@/api/schemas'
import { Button, SelectField, TextareaField, TextField } from '@/components/ui'
import { cn } from '@/lib/cn'
import { SpotAutocomplete } from './SpotAutocomplete'

/** Formular-Schema (Datum/Uhrzeit getrennt; beim Submit zu `starts_at` zusammengeführt). */
const wizardSchema = z.object({
  title: z.string().min(3, 'Mindestens 3 Zeichen.').max(150, 'Höchstens 150 Zeichen.'),
  spot_id: z.number().int().positive('Bitte einen Startplatz wählen.'),
  date: z.string().min(1, 'Bitte ein Datum wählen.'),
  time: z.string().min(1, 'Bitte eine Uhrzeit wählen.'),
  experience_level: experienceLevelSchema,
  max_participants: z.string(),
  description: z.string(),
})
type WizardValues = z.infer<typeof wizardSchema>

const STEPS: { title: string; fields: (keyof WizardValues)[] }[] = [
  { title: 'Eckdaten', fields: ['title', 'spot_id'] },
  { title: 'Termin', fields: ['date', 'time', 'experience_level'] },
  { title: 'Details', fields: [] },
]

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => (
        <li key={s.title} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold transition',
              i <= current ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/50',
            )}
          >
            {i + 1}
          </span>
          <span className={cn('hidden text-sm font-semibold sm:block', i === current ? 'text-base-content' : 'text-base-content/45')}>
            {s.title}
          </span>
          {i < STEPS.length - 1 && <span className="h-px flex-1 bg-base-300" />}
        </li>
      ))}
    </ol>
  )
}

/** Mehrstufiger Erstellen-/Wizard (RHF + Zod, schrittweise Validierung). */
export function MeetupForm({ onSubmit, submitting }: { onSubmit: (input: MeetupCreateInput) => void; submitting: boolean }) {
  const [step, setStep] = useState(0)
  const [spotName, setSpotName] = useState('')
  const {
    register,
    handleSubmit,
    trigger,
    setValue,
    formState: { errors },
  } = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      title: '',
      spot_id: 0,
      date: '',
      time: '',
      experience_level: 'all',
      max_participants: '',
      description: '',
    },
  })

  const next = async () => {
    if (await trigger(STEPS[step].fields)) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }
  const back = () => setStep((s) => Math.max(s - 1, 0))

  const submit = handleSubmit((v) => {
    const startsAt = new Date(`${v.date}T${v.time}`).toISOString()
    const max = v.max_participants.trim() === '' ? null : Math.max(1, Number(v.max_participants) || 1)
    onSubmit({
      title: v.title,
      spot_id: v.spot_id,
      starts_at: startsAt,
      experience_level: v.experience_level,
      max_participants: max,
      description: v.description.trim() === '' ? null : v.description,
    })
  })

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <Stepper current={step} />

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <TextField label="Titel" placeholder="z.B. Abendthermik am Tegelberg" error={errors.title?.message} {...register('title')} />
          <SpotAutocomplete
            label="Startplatz"
            value={spotName}
            error={errors.spot_id?.message}
            onSelect={(spot) => {
              setValue('spot_id', spot.id, { shouldValidate: true })
              setSpotName(spot.name)
            }}
          />
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Datum" type="date" error={errors.date?.message} {...register('date')} />
          <TextField label="Uhrzeit" type="time" error={errors.time?.message} {...register('time')} />
          <div className="sm:col-span-2">
            <SelectField label="Erfahrungslevel" error={errors.experience_level?.message} {...register('experience_level')}>
              <option value="all">Alle Level</option>
              <option value="beginner">Anfänger</option>
              <option value="advanced">Fortgeschritten</option>
              <option value="expert">Experte</option>
            </SelectField>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <TextField
            label="Maximale Teilnehmer (optional)"
            type="number"
            min={1}
            placeholder="z.B. 12 — leer lassen für unbegrenzt"
            {...register('max_participants')}
          />
          <TextareaField
            label="Beschreibung (optional)"
            rows={5}
            placeholder="Treffpunkt, Ablauf, Hinweise…"
            error={errors.description?.message}
            {...register('description')}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={back}>
            Zurück
          </Button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>
            Weiter
          </Button>
        ) : (
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Wird erstellt…' : 'Treffen erstellen'}
          </Button>
        )}
      </div>
    </form>
  )
}
