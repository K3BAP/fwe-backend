import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCreateSpot, useUpdateSpot } from '@/api/admin'
import { ApiError } from '@/api/http'
import { adminSpotInputSchema, type AdminSpot, type AdminSpotInput } from '@/api/schemas'
import type { AdminSpotPayload } from '@/api/schemas'
import { Button, Modal, SelectField, TextField, TextareaField } from '@/components/ui'
import { toast } from '@/stores/toastStore'
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
      className="max-w-lg"
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
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Breitengrad" inputMode="decimal" placeholder="47.7042" error={errors.lat?.message} {...register('lat')} />
          <TextField label="Längengrad" inputMode="decimal" placeholder="11.7583" error={errors.lng?.message} {...register('lng')} />
        </div>
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
