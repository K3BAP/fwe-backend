import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCreateSpot, useUpdateSpot } from '@/api/admin'
import { ApiError } from '@/api/http'
import { adminSpotInputSchema, type AdminSpot, type AdminSpotInput } from '@/api/schemas'
import type { AdminSpotPayload } from '@/api/schemas'
import { Button, Modal, SelectField, TextField, TextareaField } from '@/components/ui'
import { toast } from '@/stores/toastStore'
import { SpotLocationPicker } from './SpotLocationPicker'
import { SPOT_TYPE_LABEL } from './spotLabels'

/**
 * Anlegen/Bearbeiten eines Startplatzes. Ein Formular für beide Fälle — `spot === null` heißt neu.
 * Validierung kommt aus `adminSpotInputSchema` und spiegelt damit exakt die Server-Regeln.
 */
export function SpotFormModal({ spot, onClose }: { spot: AdminSpot | null; onClose: () => void }) {
  const isNew = spot === null
  const create = useCreateSpot()
  const update = useUpdateSpot(spot?.id ?? 0)
  const mutation = isNew ? create : update

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<AdminSpotInput>({
    resolver: zodResolver(adminSpotInputSchema),
    defaultValues: {
      name: spot?.name ?? '',
      region: spot?.region ?? '',
      country: spot?.country ?? 'DE',
      // Koordinaten als String ins Formular (Muster: `flight_hours` in ProfileEditForm).
      lat: spot?.lat?.toString() ?? '',
      lng: spot?.lng?.toString() ?? '',
      type: spot?.type ?? 'launch',
      description: spot?.description ?? '',
    },
  })

  // Die Karte ist die Eingabe, die beiden Felder bleiben die Wahrheit im Formular: leer = noch kein
  // Punkt gesetzt. `toFixed(6)` spiegelt genau DECIMAL(9,6) — sonst zeigte die Anzeige mehr
  // Nachkommastellen an, als die Spalte behält.
  const lat = useWatch({ control, name: 'lat' })
  const lng = useWatch({ control, name: 'lng' })
  const position = lat !== '' && lng !== '' ? { lat: Number(lat), lng: Number(lng) } : null

  /** Formular (Strings) → Wire-Payload (Zahlen). Die Bereichsprüfung hat Zod schon erledigt. */
  function toPayload(values: AdminSpotInput): AdminSpotPayload {
    return {
      ...values,
      country: values.country.toUpperCase(),
      lat: Number(values.lat),
      lng: Number(values.lng),
      description: values.description.trim() === '' ? null : values.description,
    }
  }

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(toPayload(values), {
      onSuccess: () => onClose(),
      onError: (e) => {
        if (e instanceof ApiError && e.fields) {
          for (const [field, message] of Object.entries(e.fields)) setError(field as keyof AdminSpotInput, { message })
        } else toast.error(e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen.')
      },
    })
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Startplatz anlegen' : 'Startplatz bearbeiten'}
      // Mit der Karte wird der Dialog zu hoch für kleine Fenster — das Panel darf deshalb scrollen.
      className="max-h-[88vh] max-w-2xl overflow-y-auto"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={onSubmit} disabled={mutation.isPending}>
            Speichern
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField label="Name" error={errors.name?.message} {...register('name')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Region" error={errors.region?.message} {...register('region')} />
          <TextField label="Land" error={errors.country?.message} {...register('country')} />
        </div>
        <SpotLocationPicker
          position={position}
          error={errors.lat?.message ?? errors.lng?.message}
          onPick={({ lat: pickedLat, lng: pickedLng }) => {
            setValue('lat', pickedLat.toFixed(6), { shouldValidate: true })
            setValue('lng', pickedLng.toFixed(6), { shouldValidate: true })
          }}
        />
        <SelectField label="Typ" error={errors.type?.message} {...register('type')}>
          {Object.entries(SPOT_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <TextareaField label="Beschreibung" rows={3} error={errors.description?.message} {...register('description')} />
      </form>
    </Modal>
  )
}
