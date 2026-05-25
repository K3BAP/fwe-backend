import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function resolve(mode: ThemeMode): boolean {
  if (mode === 'system') return media?.matches ?? false
  return mode === 'dark'
}

function apply(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', resolve(mode))
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      setMode: (mode) => {
        apply(mode)
        set({ mode })
      },
    }),
    {
      name: 'rallye-theme',
      onRehydrateStorage: () => (state) => apply(state?.mode ?? 'system'),
    },
  ),
)

// Erstanwendung + Reaktion auf Systemwechsel (nur im 'system'-Modus).
apply(useTheme.getState().mode)
media?.addEventListener('change', () => {
  if (useTheme.getState().mode === 'system') apply('system')
})
