import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useLogin } from '@/api/auth'
import { ApiError } from '@/api/http'
import { loginInputSchema, type LoginInput } from '@/api/schemas'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button, TextField } from '@/components/ui'
import { fadeUp } from '@/lib/motion'
import { toast } from '@/stores/toastStore'

/** Login-Formular (RHF + Zod). Mock-Login akzeptiert immer (kein echter Submit, M2 verkabelt). */
export function Login() {
  const navigate = useNavigate()
  const login = useLogin()
  const reduce = useReducedMotion()
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

  // Fehlgeschlagene Anmeldung (z.B. falsche Zugangsdaten → 401, oder Rate-Limit → 429) als Banner im
  // Formular zeigen: Die Login-Seite läuft außerhalb der AppShell, ein Toast (nur dort montiert) bliebe
  // unsichtbar. `login.error` trägt die deutsche Server-Nachricht und wird beim nächsten Versuch geleert.
  const errorMessage = login.error
    ? login.error instanceof ApiError
      ? login.error.message
      : 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.'
    : null

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
        <AnimatePresence>
          {errorMessage && (
            <motion.p
              key="login-error"
              role="alert"
              className="rounded-box bg-error/10 px-4 py-3 text-sm font-medium text-error"
              variants={fadeUp(4)}
              initial={reduce ? false : 'hidden'}
              animate="show"
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : 'exit'}
            >
              {errorMessage}
            </motion.p>
          )}
        </AnimatePresence>
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
