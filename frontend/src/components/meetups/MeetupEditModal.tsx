import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMeetup, useUpdateMeetup } from '@/api/meetups'
import type { MeetupDetail } from '@/api/schemas'
import { Button, Modal, Skeleton } from '@/components/ui'
import { toast } from '@/stores/toastStore'
import { MeetupBasicsFields, MeetupDetailsFields, MeetupScheduleFields } from './MeetupFields'
import { meetupFormDefaults, meetupFormSchema, toMeetupInput, type MeetupFormValues } from './meetupFormSchema'

/**
 * Das eigentliche Formular — eigene Komponente, damit RHF seine `defaultValues` erst dann einsammelt,
 * wenn das Treffen geladen ist: Sie werden beim Mounten festgehalten, ein späteres Nachreichen käme
 * zu spät und das Formular bliebe leer.
 */
function EditForm({ meetup, onClose, onSaved }: { meetup: MeetupDetail; onClose: () => void; onSaved?: () => void }) {
  const update = useUpdateMeetup(meetup.id)
  // Der Startplatz-Name bleibt als Snapshot auf der Treffen-Zeile stehen, auch wenn der Spot selbst
  // gelöscht wurde. Hier trotzdem leer starten: Sonst stünde sichtbar „Tegelberg" im Feld, während
  // `spot_id` fehlt — und „Bitte einen Startplatz wählen" läse sich beim Speichern wie ein Fehler.
  const [spotName, setSpotName] = useState(meetup.spot_id === null ? '' : meetup.spot_name)
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<MeetupFormValues>({
    resolver: zodResolver(meetupFormSchema),
    defaultValues: meetupFormDefaults(meetup),
  })

  const submit = handleSubmit((values) =>
    update.mutate(toMeetupInput(values), {
      onSuccess: () => {
        toast.success('Treffen gespeichert.')
        onSaved?.()
        onClose()
      },
      onError: () => toast.error('Speichern fehlgeschlagen.'),
    }),
  )

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <MeetupBasicsFields
        register={register}
        errors={errors}
        spotName={spotName}
        onSpotSelect={(spot) => {
          setValue('spot_id', spot.id, { shouldValidate: true })
          setSpotName(spot.name)
        }}
      />
      <MeetupScheduleFields register={register} errors={errors} />
      <MeetupDetailsFields register={register} errors={errors} />

      {/* Die Aktionsleiste steht im Formular statt im `footer` des Modals: So bleibt „Speichern" ein
          echter Submit-Button und Enter im Textfeld tut dasselbe wie der Klick. */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Speichern…' : 'Speichern'}
        </Button>
      </div>
    </form>
  )
}

/**
 * „Treffen bearbeiten" — alle Felder auf einen Blick, bewusst **ohne** den Erstellen-Wizard: Beim
 * Bearbeiten steht schon alles fest, ein Schritt-für-Schritt-Ablauf versteckt nur, was man ändern will.
 *
 * Lädt das Detail selbst, statt es sich reichen zu lassen. Damit funktioniert dieselbe Komponente auf
 * der Detailseite (Treffen liegt im Query-Cache → sofort da) wie in der Admin-Tabelle, die nur die
 * Listen-Zeile kennt und weder Beschreibung noch `spot_id` hat.
 */
export function MeetupEditModal({ meetupId, onClose, onSaved }: { meetupId: number; onClose: () => void; onSaved?: () => void }) {
  const { data: meetup, isLoading, isError } = useMeetup(meetupId)

  return (
    <Modal open onClose={onClose} title="Treffen bearbeiten" className="max-w-2xl">
      {isError && <p className="rounded-box bg-error/10 px-4 py-3 text-sm text-error">Das Treffen konnte nicht geladen werden.</p>}
      {isLoading && <Skeleton className="h-96" />}
      {!isLoading && !isError && meetup && <EditForm meetup={meetup} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  )
}
