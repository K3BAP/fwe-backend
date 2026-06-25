/** Zentrale TanStack-Query-Key-Fabrik (stabile, typisierte Keys). */
export const qk = {
  meetups: {
    all: ['meetups'] as const,
    list: (filters?: Record<string, unknown>) => ['meetups', 'list', filters ?? {}] as const,
    detail: (id: number) => ['meetups', 'detail', id] as const,
  },
  me: ['me'] as const,
} as const
