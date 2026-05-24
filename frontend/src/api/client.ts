export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  token?: string | null
  /** Wenn gesetzt, wird FormData gesendet (kein JSON-Header). */
  form?: FormData
}

/**
 * Zentraler Fetch-Wrapper. Hängt den Bearer-Token an und wirft ApiError
 * mit der deutschen Server-Fehlermeldung.
 */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`

  let body: BodyInit | undefined
  if (opts.form) {
    body = opts.form
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }

  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (body ? 'POST' : 'GET'),
    headers,
    body,
  })

  if (res.status === 204) return undefined as T

  const text = await res.text()
  const data = text ? JSON.parse(text) : null

  if (!res.ok) {
    const message =
      (data && (data.error || data.message || data.messages?.error)) ||
      'Es ist ein Fehler aufgetreten.'
    throw new ApiError(res.status, typeof message === 'string' ? message : 'Fehler.')
  }

  return data as T
}
