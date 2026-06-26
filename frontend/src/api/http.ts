import type { z } from 'zod'

const API_BASE = '/api/v1'

/** Fehler aus dem API-Envelope (`{ error: { code, message, fields? } }`, 06-backend §3). */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public fields?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

let csrfToken: string | null = null

/** Holt (und cached) das CSRF-Token für state-changing Requests (Shield, ADR-004). */
async function ensureCsrf(): Promise<string> {
  if (csrfToken) return csrfToken
  const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' })
  // Envelope-konform (API.md §2.5): `{ data: { token } }`.
  const json = (await res.json()) as { data?: { token?: string } }
  csrfToken = json.data?.token ?? ''
  return csrfToken
}

type Query = Record<string, string | number | boolean | undefined>
type ApiFetchOptions = { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown; query?: Query }

/**
 * Typisierter Fetch gegen `/api/v1`. Sendet Cookies (HttpOnly-Session) + CSRF-Header,
 * entpackt den Envelope und validiert `data` gegen ein Zod-Schema.
 */
export async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  opts: ApiFetchOptions = {},
  retryOnCsrf = true,
): Promise<T> {
  const { method = 'GET', body, query } = opts
  const url = new URL(`${API_BASE}${path}`, window.location.origin)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v))
    }
  }

  const headers: Record<string, string> = {}
  const init: RequestInit = { method, credentials: 'include', headers }
  if (body instanceof FormData) {
    // Multipart-Upload: Content-Type (inkl. Boundary) setzt der Browser selbst.
    init.body = body
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  if (method !== 'GET') headers['X-CSRF-TOKEN'] = await ensureCsrf()

  const res = await fetch(url, init)
  if (res.status === 204) return undefined as T

  const json = (await res.json().catch(() => null)) as
    | { data?: unknown; error?: { code?: string; message?: string; fields?: Record<string, string> } }
    | null

  if (!res.ok) {
    const err = json?.error ?? {}
    // Das CSRF-Token rotiert serverseitig nach Login/Logout (Shield-Session-Regeneration). Einmal
    // frisch holen und den Write wiederholen, statt den Nutzer mit „Token ungültig" zu behelligen.
    if (res.status === 403 && err.code === 'csrf_invalid' && method !== 'GET' && retryOnCsrf) {
      csrfToken = null
      return apiFetch(path, schema, opts, false)
    }
    throw new ApiError(err.code ?? 'unknown', err.message ?? 'Unbekannter Fehler.', res.status, err.fields)
  }
  // Erfolg ohne Nutzlast: `204` (Prod) oder `200 { data: null }` (Dev-Server-Fallback) → void.
  if (json?.data == null) return undefined as T
  return schema.parse(json.data)
}
