import { useSyncExternalStore } from 'react'

/**
 * Reaktiver Media-Query-Hook (z.B. `(min-width: 1024px)` für Desktop). Über `useSyncExternalStore`
 * an `matchMedia` gekoppelt — keine veralteten Werte, sauberes Auf-/Abmelden.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
