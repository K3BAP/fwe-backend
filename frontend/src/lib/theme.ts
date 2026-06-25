import { useEffect } from 'react'
import { resolveTheme, useUiStore } from '@/stores/uiStore'

/**
 * Schreibt das effektive DaisyUI-Theme als `data-theme` auf <html> und
 * reagiert bei 'system' auf Änderungen der OS-Einstellung.
 */
export function useApplyTheme(): void {
  const theme = useUiStore((s) => s.theme)
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(theme)
    }
    apply()
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}
