import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePref = 'light' | 'dark' | 'system'
export type DaisyTheme = 'flightmeet' | 'flightmeet-dark'

type UiState = {
  /** Nutzer-Präferenz (persistiert). */
  theme: ThemePref
  setTheme: (t: ThemePref) => void
  toggleTheme: () => void
}

/** UI-/Client-State. Nur `theme` wird persistiert (05-frontend.md §3). */
export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: resolveTheme(get().theme) === 'flightmeet-dark' ? 'light' : 'dark' }),
    }),
    { name: 'flightmeet-ui', partialize: (s) => ({ theme: s.theme }) },
  ),
)

/** Löst die Präferenz (inkl. 'system') zum konkreten DaisyUI-Theme auf. */
export function resolveTheme(theme: ThemePref): DaisyTheme {
  const prefersDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  return prefersDark ? 'flightmeet-dark' : 'flightmeet'
}
