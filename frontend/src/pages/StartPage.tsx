import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner'
import { AnimatePresence, motion } from 'motion/react'
import { useSession } from '../store/session'
import { Button, Card, Centered, Input, Label, ThemeToggle } from '../components/ui'
import { Item, Stagger } from '../components/motion'
import { spring } from '../lib/motion'

/** Beitritts-Code aus einem gescannten Link (…/r/<code>) oder Rohwert lösen. */
function extractJoinCode(raw: string): string | null {
  const match = raw.match(/\/r\/([^/?#]+)/)
  if (match) return decodeURIComponent(match[1])
  // Reiner Code ohne URL (kein Slash/Leerzeichen) ebenfalls akzeptieren.
  const trimmed = raw.trim()
  return /^[^\s/]+$/.test(trimmed) ? trimmed : null
}

export default function StartPage() {
  const token = useSession((s) => s.token)
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [scanning, setScanning] = useState(false)

  if (token) return <Navigate to="/rallye" replace />

  const onScan = (codes: IDetectedBarcode[]) => {
    const raw = codes[0]?.rawValue
    if (!raw) return
    const joinCode = extractJoinCode(raw)
    if (joinCode) {
      setScanning(false)
      navigate(`/r/${joinCode}`)
    }
  }

  return (
    <Centered>
      <div className="fixed right-3 top-3 z-10 safe-top">
        <ThemeToggle className="text-muted" />
      </div>
      <Stagger className="w-full max-w-md space-y-6">
        <Item className="text-center">
          <motion.img
            src={`${import.meta.env.BASE_URL}icon.svg`}
            alt=""
            className="mx-auto h-20 w-20 drop-shadow-lg"
            initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={spring}
          />
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-fg">City-Rallye</h1>
          <p className="mt-1 text-muted">FSR Informatik · Universität Trier</p>
        </Item>

        <Item>
          <Card>
            <p className="text-fg">
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

            <div className="mt-4 border-t border-line pt-4">
              <AnimatePresence mode="wait" initial={false}>
                {scanning ? (
                  <motion.div
                    key="scanner"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 overflow-hidden"
                  >
                    <div className="overflow-hidden rounded-xl">
                      <Scanner onScan={onScan} components={{ finder: true }} />
                    </div>
                    <Button variant="secondary" className="w-full" onClick={() => setScanning(false)}>
                      Abbrechen
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div key="scan-btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Button variant="secondary" className="w-full" onClick={() => setScanning(true)}>
                      QR-Code scannen
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </Item>

        <Item className="text-center">
          <Button variant="ghost" onClick={() => navigate('/admin/login')}>
            Admin-Anmeldung
          </Button>
        </Item>
      </Stagger>
    </Centered>
  )
}
