/** Zentrale TanStack-Query-Key-Fabrik (stabile, typisierte Keys). */
export const qk = {
  meetups: {
    all: ['meetups'] as const,
    list: (filters?: Record<string, unknown>) => ['meetups', 'list', filters ?? {}] as const,
    detail: (id: number) => ['meetups', 'detail', id] as const,
  },
  groups: {
    all: ['groups'] as const,
    list: (filters?: Record<string, unknown>) => ['groups', 'list', filters ?? {}] as const,
    detail: (id: number) => ['groups', 'detail', id] as const,
    members: (id: number) => ['groups', 'detail', id, 'members'] as const,
    feed: (id: number) => ['groups', 'detail', id, 'feed'] as const,
    requests: (id: number) => ['groups', 'detail', id, 'requests'] as const,
    invites: (id: number) => ['groups', 'detail', id, 'invites'] as const,
  },
  spots: ['spots'] as const,
  me: ['me'] as const,
} as const
