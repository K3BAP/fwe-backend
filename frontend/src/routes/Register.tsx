import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { useRegister } from '@/api/auth'
import { ApiError } from '@/api/http'
import { registerInputSchema, type RegisterInput } from '@/api/schemas'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button, TextField } from '@/components/ui'
import { toast } from '@/stores/toastStore'

/** Registrierungs-Formular (RHF + Zod, minimale Felder nach ADR-010). Mock-Accept. */
export function Register() {
  const navigate = useNavigate()
  const registerUser = useRegister()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerInputSchema),
    defaultValues: { display_name: '', email: '', password: '', handle: '' },
  })

  const onSubmit = handleSubmit((values) => {
    registerUser.mutate(values, {
      onSuccess: () => {
        toast.success('Konto erstellt – willkommen bei FlightMeet! 🪂')
        navigate('/')
      },
      onError: (e) => {
        // Server-Konflikte (vergebene E-Mail/Benutzername) direkt am passenden Feld zeigen.
        if (e instanceof ApiError && e.code === 'handle_taken') setError('handle', { message: e.message })
        else if (e instanceof ApiError && e.code === 'email_taken') setError('email', { message: e.message })
        else if (e instanceof ApiError && e.fields) {
          for (const [field, message] of Object.entries(e.fields)) setError(field as keyof RegisterInput, { message })
        } else toast.error(e instanceof ApiError ? e.message : 'Registrierung fehlgeschlagen.')
      },
    })
  })

  return (
    <AuthLayout
      title="Konto erstellen"
      subtitle="In zwei Minuten startklar."
      footer={
        <>
          Schon registriert?{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Anmelden
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Anzeigename"
          autoComplete="name"
          placeholder="Lena Krüger"
          error={errors.display_name?.message}
          {...register('display_name')}
        />
        <TextField
          label="Benutzername"
          autoComplete="username"
          placeholder="lenak"
          error={errors.handle?.message}
          {...register('handle')}
        />
        <TextField
          label="E-Mail"
          type="email"
          autoComplete="email"
          placeholder="du@example.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Passwort"
          type="password"
          autoComplete="new-password"
          placeholder="Mindestens 8 Zeichen"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" size="lg" className="mt-1" disabled={registerUser.isPending}>
          {registerUser.isPending ? 'Konto wird erstellt…' : 'Konto erstellen'}
        </Button>
      </form>
    </AuthLayout>
  )
}
