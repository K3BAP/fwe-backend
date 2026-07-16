import { resolveTheme, useUiStore } from '@/stores/uiStore'
import { MoonIcon, SunIcon } from './icons'

/** Schaltet zwischen Light- und Dark-Theme (UiStore, persistiert). */
export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme)
  const toggle = useUiStore((s) => s.toggleTheme)
  const isDark = resolveTheme(theme) === 'flightmeet-dark'
  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-circle btn-ghost btn-sm"
      aria-label={isDark ? 'Zu hellem Design wechseln' : 'Zu dunklem Design wechseln'}
    >
      {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  )
}
