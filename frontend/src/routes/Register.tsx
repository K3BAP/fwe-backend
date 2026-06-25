import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { useRegister } from '@/api/auth'
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
          label="Benutzername (optional)"
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
