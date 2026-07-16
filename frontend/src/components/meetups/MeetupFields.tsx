import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import type { Spot } from '@/api/schemas'
import { SelectField, TextareaField, TextField } from '@/components/ui'
import { SpotAutocomplete } from './SpotAutocomplete'
import type { MeetupFormValues } from './meetupFormSchema'

/**
 * Die drei Feldgruppen des Treffen-Formulars. Der Erstellen-Wizard zeigt sie nacheinander, das
 * Bearbeiten-Modal alle drei untereinander — die Felder selbst sind in beiden Fällen dieselben,
 * deshalb liegen sie hier und nicht in einer der beiden Formen.
 */
type FieldGroupProps = {
  register: UseFormRegister<MeetupFormValues>
  errors: FieldErrors<MeetupFormValues>
}

/** Titel + Startplatz. */
export function MeetupBasicsFields({
  register,
  errors,
  spotName,
  onSpotSelect,
}: FieldGroupProps & { spotName: string; onSpotSelect: (spot: Spot) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <TextField label="Titel" placeholder="z.B. Abendthermik am Tegelberg" error={errors.title?.message} {...register('title')} />
      <SpotAutocomplete label="Startplatz" value={spotName} error={errors.spot_id?.message} onSelect={onSpotSelect} />
    </div>
  )
}

/** Datum, Uhrzeit, Erfahrungslevel. */
export function MeetupScheduleFields({ register, errors }: FieldGroupProps) {
  return (
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
  )
}

/** Optionales: Platzlimit + Beschreibung. */
export function MeetupDetailsFields({ register, errors }: FieldGroupProps) {
  return (
    <div className="flex flex-col gap-4">
      <TextField
        label="Maximale Teilnehmer (optional)"
        type="number"
        min={1}
        placeholder="z.B. 12 — leer lassen für unbegrenzt"
        error={errors.max_participants?.message}
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
  )
}
