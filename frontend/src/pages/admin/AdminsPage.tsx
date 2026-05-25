import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useAdmins, useCreateAdmin, useDeleteAdmin } from '../../api/admin'
import { useAdminAuth } from '../../store/adminAuth'
import { ApiError } from '../../api/client'
import { Button, Card, ErrorText, Input, Label, Skeleton } from '../../components/ui'
import { Item, Stagger } from '../../components/motion'
import { spring } from '../../lib/motion'

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
      <h1 className="text-2xl font-bold text-fg">Admin-Konten</h1>

      <Card className="space-y-3">
        <h2 className="font-semibold text-fg">Neues Konto</h2>
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
        <Button onClick={submit} loading={create.isPending} disabled={!username.trim() || password.length < 6}>
          Konto erstellen
        </Button>
      </Card>

      {isLoading && <Skeleton className="h-16 w-full" />}
      <Stagger className="space-y-2">
        <AnimatePresence initial={false}>
          {admins?.map((a) => (
            <Item key={a.id}>
              <motion.div layout exit={{ opacity: 0, scale: 0.95 }} transition={spring}>
                <Card className="flex items-center justify-between">
                  <span className="font-medium text-fg">{a.username}</span>
                  {a.id !== me?.id && (
                    <button
                      onClick={() => confirm(`Admin „${a.username}" löschen?`) && del.mutate(a.id)}
                      className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      Löschen
                    </button>
                  )}
                </Card>
              </motion.div>
            </Item>
          ))}
        </AnimatePresence>
      </Stagger>
    </div>
  )
}
