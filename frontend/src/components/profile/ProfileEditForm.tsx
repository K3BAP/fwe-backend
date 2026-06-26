import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { profileEditInputSchema, type Profile, type ProfileEditInput } from '@/api/schemas'
import { Avatar, Button, SelectField, TextareaField, TextField } from '@/components/ui'

/** „Profil bearbeiten" (RHF + Zod). Avatar-Upload als Mock (Object-URL, kein echter Upload). */
export function ProfileEditForm({
  profile,
  onSubmit,
  submitting,
}: {
  profile: Profile
  onSubmit: (input: ProfileEditInput) => void
  submitting: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_path)
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProfileEditInput>({
    resolver: zodResolver(profileEditInputSchema),
    defaultValues: {
      display_name: profile.display_name,
      handle: profile.handle ?? '',
      bio: profile.bio ?? '',
      experience_level: profile.experience_level ?? '',
      license_class: profile.license_class ?? '',
      glider: profile.glider ?? '',
      home_region: profile.home_region ?? '',
      flight_hours: profile.flight_hours?.toString() ?? '',
      avatar_path: profile.avatar_path,
    },
  })

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setAvatarPreview(url)
    setValue('avatar_path', url)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="flex items-center gap-4">
        <Avatar name={profile.display_name} src={avatarPreview} size={72} />
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            Avatar ändern
          </Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </div>
      </div>

      <TextField label="Anzeigename" error={errors.display_name?.message} {...register('display_name')} />
      <TextField label="Benutzername" placeholder="z.B. lenak" error={errors.handle?.message} {...register('handle')} />
      <TextareaField label="Bio" rows={3} placeholder="Erzähl etwas über dich…" error={errors.bio?.message} {...register('bio')} />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Erfahrungslevel" {...register('experience_level')}>
          <option value="">— keine Angabe —</option>
          <option value="beginner">Anfänger</option>
          <option value="advanced">Fortgeschritten</option>
          <option value="expert">Experte</option>
        </SelectField>
        <TextField label="Flugstunden" type="number" min={0} {...register('flight_hours')} />
        <TextField label="Lizenz" placeholder="z.B. B-Schein" {...register('license_class')} />
        <TextField label="Schirm" placeholder="z.B. Nova Mentor 7" {...register('glider')} />
      </div>
      <TextField label="Heimatregion" placeholder="z.B. Allgäu" {...register('home_region')} />

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Speichern…' : 'Speichern'}
        </Button>
      </div>
    </form>
  )
}
