import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useSession } from '../store/session'
import { Button, Card, Centered, Input, Label } from '../components/ui'

export default function StartPage() {
  const token = useSession((s) => s.token)
  const navigate = useNavigate()
  const [code, setCode] = useState('')

  if (token) return <Navigate to="/rallye" replace />

  return (
    <Centered>
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="mx-auto h-20 w-20" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">City-Rallye</h1>
          <p className="mt-1 text-slate-600">FSR Informatik · Universität Trier</p>
        </div>

        <Card>
          <p className="text-slate-700">
            Scanne den QR-Code deiner Rallye oder gib den Beitritts-Code ein, um teilzunehmen.
          </p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (code.trim()) navigate(`/r/${code.trim()}`)
            }}
          >
            <div>
              <Label>Beitritts-Code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="z. B. trier"
                autoCapitalize="none"
              />
            </div>
            <Button type="submit" className="w-full" disabled={!code.trim()}>
              Zur Rallye
            </Button>
          </form>
        </Card>

        <div className="text-center">
          <Button variant="ghost" onClick={() => navigate('/admin/login')}>
            Admin-Anmeldung
          </Button>
        </div>
      </div>
    </Centered>
  )
}
