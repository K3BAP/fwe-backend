import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { useLogin } from '@/api/auth'
import { loginInputSchema, type LoginInput } from '@/api/schemas'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button, TextField } from '@/components/ui'
import { toast } from '@/stores/toastStore'

/** Login-Formular (RHF + Zod). Mock-Login akzeptiert immer (kein echter Submit, M2 verkabelt). */
export function Login() {
  const navigate = useNavigate()
  const login = useLogin()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: () => {
        toast.success('Willkommen zurück! 🪂')
        navigate('/')
      },
    })
  })

  return (
    <AuthLayout
      title="Anmelden"
      subtitle="Schön, dass du wieder da bist."
      footer={
        <>
          Noch kein Konto?{' '}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Registrieren
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
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
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" size="lg" className="mt-1" disabled={login.isPending}>
          {login.isPending ? 'Anmelden…' : 'Anmelden'}
        </Button>
      </form>
    </AuthLayout>
  )
}
