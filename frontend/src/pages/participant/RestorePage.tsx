import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSession } from '../../store/session'
import { api } from '../../api/client'
import type { Participant, Rallye } from '../../api/types'
import { Button, Card, Centered, Spinner } from '../../components/ui'

/** Stellt eine Teilnehmer-Sitzung über einen Login-Link (/s/:token) wieder her. */
export default function RestorePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const session = useSession()
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!token) return
    api<{ participant: Participant; rallye: Rallye }>('/me', { token })
      .then((res) => {
        session.setToken(token)
        session.setRallye(res.rallye.join_code, res.rallye.id)
        navigate('/rallye', { replace: true })
      })
      .catch(() => setError(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  if (error)
    return (
      <Centered>
        <Card className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-slate-900">Link ungültig</h1>
          <p className="mt-2 text-slate-600">Dieser Login-Link ist nicht mehr gültig.</p>
          <Button className="mt-4 w-full" onClick={() => navigate('/')}>
            Zur Startseite
          </Button>
        </Card>
      </Centered>
    )

  return (
    <Centered>
      <Spinner />
    </Centered>
  )
}
