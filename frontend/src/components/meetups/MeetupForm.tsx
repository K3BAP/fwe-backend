import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { MeetupCreateInput } from '@/api/schemas'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { MeetupBasicsFields, MeetupDetailsFields, MeetupScheduleFields } from './MeetupFields'
import { meetupFormDefaults, meetupFormSchema, toMeetupInput, type MeetupFormValues } from './meetupFormSchema'

const STEPS: { title: string; fields: (keyof MeetupFormValues)[] }[] = [
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

/**
 * Mehrstufiger Wizard zum **Erstellen** eines Treffens (RHF + Zod, schrittweise Validierung).
 * Bearbeitet wird nicht hier, sondern flach im `MeetupEditModal`: Wer nur die Uhrzeit korrigiert,
 * soll sich nicht durch drei Schritte klicken.
 */
export function MeetupForm({ onSubmit, submitting }: { onSubmit: (input: MeetupCreateInput) => void; submitting: boolean }) {
  const [step, setStep] = useState(0)
  const [spotName, setSpotName] = useState('')
  const {
    register,
    handleSubmit,
    trigger,
    setValue,
    formState: { errors },
  } = useForm<MeetupFormValues>({
    resolver: zodResolver(meetupFormSchema),
    defaultValues: meetupFormDefaults(),
  })

  const next = async () => {
    if (await trigger(STEPS[step].fields)) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }
  const back = () => setStep((s) => Math.max(s - 1, 0))
  const submit = handleSubmit((values) => onSubmit(toMeetupInput(values)))
  const isLastStep = step === STEPS.length - 1

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <Stepper current={step} />

      {step === 0 && (
        <MeetupBasicsFields
          register={register}
          errors={errors}
          spotName={spotName}
          onSpotSelect={(spot) => {
            setValue('spot_id', spot.id, { shouldValidate: true })
            setSpotName(spot.name)
          }}
        />
      )}
      {step === 1 && <MeetupScheduleFields register={register} errors={errors} />}
      {step === 2 && <MeetupDetailsFields register={register} errors={errors} />}

      <div className="flex items-center justify-between">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={back}>
            Zurück
          </Button>
        ) : (
          <span />
        )}
        {/* Die `key`s trennen „Weiter" und „Treffen erstellen" bewusst in zwei DOM-Knoten. Ohne sie
            recycelt React denselben <button> und dreht nur `type` von "button" auf "submit" um —
            und zwar noch während der Klick läuft: Der Browser wertet die Default-Aktion erst nach den
            Microtasks aus, sieht dort schon "submit" und schickt das Formular ab. Genau daran war
            Schritt 3 nie erreichbar — „Weiter" auf Schritt 2 legte das Treffen sofort an. */}
        {isLastStep ? (
          <Button key="submit" type="submit" disabled={submitting}>
            {submitting ? 'Wird erstellt…' : 'Treffen erstellen'}
          </Button>
        ) : (
          <Button key="next" type="button" onClick={next}>
            Weiter
          </Button>
        )}
      </div>
    </form>
  )
}
