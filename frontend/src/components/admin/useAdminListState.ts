import { useSearchParams } from 'react-router-dom'

export const ADMIN_PAGE_SIZE = 20

/**
 * Filter-, Sortier- und Seiten-Zustand in der **URL** (teilbar, Back-Button funktioniert) — dasselbe
 * Muster wie `routes/Flugtreffen.tsx`, hier aber einmal statt viermal: die vier Admin-Listen brauchen
 * exakt dieses Plumbing, nur mit anderen Feldnamen. Die Seiten deklarieren ihre Felder, der Hook hält
 * die Mechanik.
 *
 * `patch()` arbeitet generisch auf den vorhandenen Parametern: leere Werte fliegen raus (so landet nie
 * `?sort=` in der URL), der Default-Sort ebenfalls, und die Seite springt bewusst auf 1 zurück — ein
 * Filterwechsel auf Seite 7 hätte sonst oft ein leeres Ergebnis.
 */
export function useAdminListState(defaultSort: string) {
  const [params, setParams] = useSearchParams()

  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const sort = params.get('sort') ?? defaultSort

  /** Wert eines Filters ('' wenn nicht gesetzt — passt direkt an ein <select>/<input>). */
  const get = (key: string): string => params.get(key) ?? ''

  function patch(changes: Record<string, string>) {
    const sp = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) sp.set(key, value)
      else sp.delete(key)
    }
    if (sp.get('sort') === defaultSort) sp.delete('sort')
    sp.delete('page')
    setParams(sp, { replace: true })
  }

  function goToPage(next: number) {
    const sp = new URLSearchParams(params)
    if (next <= 1) sp.delete('page')
    else sp.set('page', String(next))
    setParams(sp, { replace: true })
  }

  return { page, sort, get, patch, goToPage, offset: (page - 1) * ADMIN_PAGE_SIZE, limit: ADMIN_PAGE_SIZE }
}
