import { useEffect, useRef } from 'react'
import { resolveTheme, useUiStore } from '@/stores/uiStore'

let themeTimer: number | undefined

/**
 * Aktiviert den weichen Theme-Crossfade: setzt für die Dauer des Wechsels die Klasse `theme-transition`
 * auf <html> (die zugehörige CSS-Regel blendet Farben/Hintergründe/Ränder weich über) und entfernt sie
 * danach wieder — so bleiben Hover/Focus den Rest der Zeit ohne Verzögerung. Ein einzelner Timer statt
 * `transitionend` (das feuert pro Eigenschaft/Element und ist für eine `*`-Regel unzuverlässig).
 */
function runThemeTransition(root: HTMLElement): void {
  root.classList.add('theme-transition')
  window.clearTimeout(themeTimer)
  themeTimer = window.setTimeout(() => root.classList.remove('theme-transition'), 320)
}

/**
 * Schreibt das effektive DaisyUI-Theme als `data-theme` auf <html> und reagiert bei 'system' auf
 * Änderungen der OS-Einstellung. **Theme-Wechsel** (Toggle oder OS-Wechsel) werden weich übergeblendet;
 * die **Erst-Anwendung beim Mount** wird bewusst *nicht* animiert (kein Crossfade beim Seitenaufbau).
 * Respektiert `prefers-reduced-motion` (dann harter Wechsel ohne Überblendung).
 */
export function useApplyTheme(): void {
  const theme = useUiStore((s) => s.theme)
  const mounted = useRef(false)
  useEffect(() => {
    const root = document.documentElement
    const apply = (animate: boolean) => {
      const next = resolveTheme(theme)
      if (root.dataset.theme === next) return
      const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (animate && !prefersReduce) runThemeTransition(root)
      root.dataset.theme = next
    }
    apply(mounted.current) // Mount: nie animieren; spätere Re-Runs (Toggle): animieren
    mounted.current = true
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply(true)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])
}
