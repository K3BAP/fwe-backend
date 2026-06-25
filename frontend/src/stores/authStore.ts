import { create } from 'zustand'

/** Session-Snapshot — gespeist aus `GET /api/v1/auth/me`, **kein Token** (HttpOnly-Cookie). */
export type SessionUser = {
  id: number
  displayName: string
  avatarUrl: string | null
}

type AuthState = {
  user: SessionUser | null
  status: 'unknown' | 'authenticated' | 'guest'
  isAuthenticated: () => boolean
  setFromMe: (user: SessionUser | null) => void
  clear: () => void
}

/**
 * Reiner Session-/UI-Spiegel des `['me']`-Query (05-frontend.md §3.1).
 * Hält bewusst keinen Token; `isAuthenticated()` ist nur eine UX-Heuristik.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'unknown',
  isAuthenticated: () => get().status === 'authenticated',
  setFromMe: (user) => set({ user, status: user ? 'authenticated' : 'guest' }),
  clear: () => set({ user: null, status: 'guest' }),
}))
