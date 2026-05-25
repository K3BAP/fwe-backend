import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSession } from '../../store/session'
import { useJoin, useRallyeByCode } from '../../api/participant'
import { ApiError } from '../../api/client'
import { Button, Card, Centered, ErrorText, Input, Label, Spinner } from '../../components/ui'
import { PageTransition } from '../../components/motion'

export default function JoinPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const session = useSession()
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  // Rallye-Code sofort persistieren, damit die Sitzung erhalten bleibt.
  useEffect(() => {
    if (code) session.setRallye(code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const { data: rallye, isLoading, isError } = useRallyeByCode(code)
  const join = useJoin()

  // Bereits angemeldet? Direkt in die Rallye.
  useEffect(() => {
    if (session.token) navigate('/rallye', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code || !name.trim()) return
    setError('')
    try {
      const res = await join.mutateAsync({ code, displayName: name.trim() })
      session.setToken(res.token)
      session.setRallye(code, res.rallye.id)
      navigate(res.rallye.teams_enabled ? '/rallye/team' : '/rallye', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Beitritt fehlgeschlagen.')
    }
  }

  if (isLoading)
    return (
      <Centered>
        <Spinner />
      </Centered>
    )

  if (isError || !rallye)
    return (
      <Centered>
        <PageTransition>
          <Card className="max-w-md text-center">
            <h1 className="text-lg font-semibold text-fg">Rallye nicht gefunden</h1>
            <p className="mt-2 text-muted">Bitte überprüfe den QR-Code oder Beitritts-Code.</p>
            <Button className="mt-4 w-full" onClick={() => navigate('/')}>
              Zurück
            </Button>
          </Card>
        </PageTransition>
      </Centered>
    )

  return (
    <Centered>
      <PageTransition className="w-full max-w-md space-y-5">
        <div className="text-center">
          {rallye.theme && <p className="text-sm font-medium text-brand-600 dark:text-brand-300">{rallye.theme}</p>}
          <h1 className="mt-1 text-2xl font-bold text-fg">{rallye.title}</h1>
          {rallye.description && <p className="mt-2 text-muted">{rallye.description}</p>}
        </div>

        {rallye.status !== 'active' ? (
          <Card className="text-center">
            <p className="text-fg">Diese Rallye ist derzeit nicht aktiv.</p>
          </Card>
        ) : (
          <Card>
            <form className="space-y-4" onSubmit={submit}>
              <div>
                <Label>Dein Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Wie heißt du?"
                  maxLength={80}
                  autoFocus
                />
              </div>
              <ErrorText>{error}</ErrorText>
              <Button type="submit" className="w-full" loading={join.isPending} disabled={!name.trim()}>
                Mitmachen
              </Button>
            </form>
          </Card>
        )}
      </PageTransition>
    </Centered>
  )
}
