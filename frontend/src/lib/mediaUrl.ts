/**
 * Macht einen serverseitigen Medienpfad Deploy-Base-bewusst (wie `API_BASE`/Router-`basename`):
 * `/media/uploads/avatars/x.webp` → Dev `/media/…`, Prod (Vite-base `/public/`) `/public/media/…`.
 * Object-URL-Vorschauen (`blob:`), `data:` und absolute `http(s):`-URLs bleiben unverändert.
 */
export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  if (!path.startsWith('/')) return path
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`
}
