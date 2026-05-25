import { useInstallPrompt } from '../lib/install'
import { Button, Card } from './ui'

/**
 * "Jetzt installieren"-Hinweis. Wird bewusst erst nach dem Beitritt angezeigt:
 * Der Sitzungs-Token liegt dann bereits im localStorage, sodass die installierte
 * PWA beim ersten Öffnen direkt angemeldet ist.
 */
export default function InstallBanner() {
  const { canInstall, isStandalone, promptInstall } = useInstallPrompt()

  if (!canInstall || isStandalone) return null

  return (
    <Card className="bg-indigo-50 ring-indigo-200">
      <p className="text-sm text-indigo-900">
        Installiere die App jetzt – du bleibst angemeldet und kommst beim nächsten Mal mit einem Tippen zurück in deine Rallye.
      </p>
      <Button variant="secondary" className="mt-3 w-full" onClick={promptInstall}>
        Jetzt installieren
      </Button>
    </Card>
  )
}
