/** Zentrale TanStack-Query-Key-Fabrik (stabile, typisierte Keys). */
export const qk = {
  meetups: {
    all: ['meetups'] as const,
    list: (filters?: Record<string, unknown>) => ['meetups', 'list', filters ?? {}] as const,
    detail: (id: number) => ['meetups', 'detail', id] as const,
    weather: (id: number) => ['meetups', 'detail', id, 'weather'] as const,
    briefing: (id: number) => ['meetups', 'detail', id, 'briefing'] as const,
  },
  groups: {
    all: ['groups'] as const,
    list: (filters?: Record<string, unknown>) => ['groups', 'list', filters ?? {}] as const,
    detail: (id: number) => ['groups', 'detail', id] as const,
    members: (id: number) => ['groups', 'detail', id, 'members'] as const,
    channels: (id: number) => ['groups', 'detail', id, 'channels'] as const,
    feed: (id: number) => ['groups', 'detail', id, 'feed'] as const,
    requests: (id: number) => ['groups', 'detail', id, 'requests'] as const,
    invites: (id: number) => ['groups', 'detail', id, 'invites'] as const,
  },
  spots: ['spots'] as const,
  users: ['users'] as const,
  chat: {
    conversations: ['chat', 'conversations'] as const,
    detail: (id: number) => ['chat', 'detail', id] as const,
    messages: (id: number) => ['chat', 'messages', id] as const,
    unread: ['chat', 'unread'] as const,
  },
  profiles: (userId: number) => ['profiles', userId] as const,
  notifications: {
    list: ['notifications'] as const,
    unread: ['notifications', 'unread'] as const,
  },
  me: ['me'] as const,
} as const
