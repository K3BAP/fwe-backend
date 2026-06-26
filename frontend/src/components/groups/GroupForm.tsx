import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { groupJoinPolicySchema, groupVisibilitySchema, type GroupCreateInput } from '@/api/schemas'
import { Button, SelectField, TextareaField, TextField } from '@/components/ui'

const formSchema = z.object({
  name: z.string().min(3, 'Mindestens 3 Zeichen.').max(80, 'Höchstens 80 Zeichen.'),
  description: z.string(),
  region: z.string(),
  tags: z.string(),
  rules_text: z.string(),
  visibility: groupVisibilitySchema,
  join_policy: groupJoinPolicySchema,
})
type FormValues = z.infer<typeof formSchema>

const orNull = (s: string) => (s.trim() === '' ? null : s.trim())

/** Formular „Gruppe erstellen" (RHF + Zod). Tags als kommagetrennte Eingabe. */
export function GroupForm({ onSubmit, submitting }: { onSubmit: (input: GroupCreateInput) => void; submitting: boolean }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', description: '', region: '', tags: '', rules_text: '', visibility: 'public', join_policy: 'open' },
  })

  const submit = handleSubmit((v) => {
    const tags = v.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    onSubmit({
      name: v.name,
      description: orNull(v.description),
      region: orNull(v.region),
      tags: tags.length ? tags : null,
      rules_text: orNull(v.rules_text),
      visibility: v.visibility,
      join_policy: v.join_policy,
    })
  })

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <TextField label="Name" placeholder="z.B. Allgäu Thermikjäger" error={errors.name?.message} {...register('name')} />
      <TextareaField label="Beschreibung" rows={3} placeholder="Worum geht es in der Gruppe?" {...register('description')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Region" placeholder="z.B. Allgäu" {...register('region')} />
        <TextField label="Tags (kommagetrennt)" placeholder="Streckenflug, Thermik" {...register('tags')} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Sichtbarkeit" {...register('visibility')}>
          <option value="public">Öffentlich</option>
          <option value="unlisted">Nicht gelistet</option>
          <option value="private">Privat</option>
        </SelectField>
        <SelectField label="Beitritt" {...register('join_policy')}>
          <option value="open">Direktbeitritt</option>
          <option value="request">Auf Antrag</option>
          <option value="invite_only">Nur Einladung</option>
        </SelectField>
      </div>
      <TextareaField label="Regeln (optional)" rows={3} placeholder="Verhaltensregeln, Hinweise…" {...register('rules_text')} />
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Wird erstellt…' : 'Gruppe erstellen'}
        </Button>
      </div>
    </form>
  )
}
