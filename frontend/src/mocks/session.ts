import type { SessionUser } from '@/stores/authStore'

/**
 * Veränderlicher Mock-Session-Zustand (M1). `login`/`logout` schalten das Flag, `me` liest es —
 * so sind Gast-Landing und eingeloggte App im Prototyp beide erlebbar. In M2 ersetzt durch
 * echte Shield-Session (`GET/POST /auth/*`).
 */
const SESSION_USER: SessionUser = { id: 1, displayName: 'Lena Krüger', avatarUrl: null }
let loggedIn = true

export const sessionMock = {
  me: (): SessionUser | null => (loggedIn ? { ...SESSION_USER } : null),
  login: (): SessionUser => {
    loggedIn = true
    return { ...SESSION_USER }
  },
  logout: (): void => {
    loggedIn = false
  },
}
