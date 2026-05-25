import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAdminLogin } from '../../api/admin'
import { useAdminAuth } from '../../store/adminAuth'
import { ApiError } from '../../api/client'
import { Button, Card, Centered, ErrorText, Input, Label } from '../../components/ui'
import { PageTransition } from '../../components/motion'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const auth = useAdminAuth()
  const login = useAdminLogin()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  if (auth.token) return <Navigate to="/admin" replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const res = await login.mutateAsync({ username, password })
      auth.login(res.token, res.admin)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Anmeldung fehlgeschlagen.')
    }
  }

  return (
    <Centered>
      <PageTransition className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="mx-auto h-16 w-16" />
          <h1 className="mt-3 text-xl font-bold text-fg">Admin-Anmeldung</h1>
        </div>
        <Card>
          <form className="space-y-4" onSubmit={submit}>
            <div>
              <Label>Benutzername</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoFocus />
            </div>
            <div>
              <Label>Passwort</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" className="w-full" loading={login.isPending}>
              Anmelden
            </Button>
          </form>
        </Card>
      </PageTransition>
    </Centered>
  )
}
