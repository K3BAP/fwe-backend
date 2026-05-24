import { useState } from 'react'
import { useAdmins, useCreateAdmin, useDeleteAdmin } from '../../api/admin'
import { useAdminAuth } from '../../store/adminAuth'
import { ApiError } from '../../api/client'
import { Button, Card, ErrorText, Input, Label, Spinner } from '../../components/ui'

export default function AdminsPage() {
  const { data: admins, isLoading } = useAdmins()
  const create = useCreateAdmin()
  const del = useDeleteAdmin()
  const me = useAdminAuth((s) => s.admin)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    try {
      await create.mutateAsync({ username: username.trim(), password })
      setUsername('')
      setPassword('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Anlegen fehlgeschlagen.')
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Admin-Konten</h1>

      <Card className="space-y-3">
        <h2 className="font-semibold text-slate-900">Neues Konto</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Benutzername</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" />
          </div>
          <div>
            <Label>Passwort (min. 6 Zeichen)</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <ErrorText>{error}</ErrorText>
        <Button onClick={submit} disabled={!username.trim() || password.length < 6 || create.isPending}>
          Konto erstellen
        </Button>
      </Card>

      {isLoading && <Spinner />}
      <div className="space-y-2">
        {admins?.map((a) => (
          <Card key={a.id} className="flex items-center justify-between">
            <span className="font-medium text-slate-900">{a.username}</span>
            {a.id !== me?.id && (
              <button
                onClick={() => confirm(`Admin „${a.username}" löschen?`) && del.mutate(a.id)}
                className="text-sm font-medium text-red-600 hover:underline"
              >
                Löschen
              </button>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
