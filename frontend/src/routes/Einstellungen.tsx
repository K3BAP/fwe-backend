import { useNavigate } from 'react-router-dom'
import { useLogout } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore, type ThemePref } from '@/stores/uiStore'
import { Avatar, Button, Card, SegmentedControl, type SegmentOption } from '@/components/ui'
import { toast } from '@/stores/toastStore'

const THEME_OPTIONS: SegmentOption<ThemePref>[] = [
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
  { value: 'system', label: 'System' },
]

/** Einstellungen: Farbschema + Konto (Mock-Logout). */
export function Einstellungen() {
  const navigate = useNavigate()
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl">Einstellungen</h1>
        <p className="mt-1 text-base-content/60">Darstellung und Konto.</p>
      </div>

      <Card className="p-5">
        <h2 className="font-display text-lg">Darstellung</h2>
        <p className="mb-4 mt-1 text-sm text-base-content/55">Wähle dein bevorzugtes Farbschema.</p>
        <SegmentedControl options={THEME_OPTIONS} value={theme} onChange={setTheme} aria-label="Farbschema" />
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <h2 className="font-display text-lg">Konto</h2>
        <div className="flex items-center gap-3">
          <Avatar name={user?.displayName ?? 'Gast'} src={user?.avatarUrl} size={48} />
          <div>
            <div className="font-semibold">{user?.displayName ?? 'Gast'}</div>
            <div className="text-sm text-base-content/55">lena@flightmeet.de</div>
          </div>
        </div>
        <div>
          <Button
            variant="outline"
            disabled={logout.isPending}
            onClick={() =>
              logout.mutate(undefined, {
                onSuccess: () => {
                  toast.info('Abgemeldet.')
                  navigate('/landing')
                },
              })
            }
          >
            Abmelden
          </Button>
        </div>
      </Card>
    </div>
  )
}
