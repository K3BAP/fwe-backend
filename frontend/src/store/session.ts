import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Teilnehmer-Sitzung. Token & geladene Rallye werden im localStorage
 * persistiert, damit die Sitzung bestehen bleibt, bis der Teilnehmer die
 * Rallye ausdrücklich verlässt.
 */
interface SessionState {
  token: string | null
  rallyeCode: string | null
  rallyeId: number | null
  setToken: (token: string) => void
  setRallye: (code: string, id?: number | null) => void
  leave: () => void
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      rallyeCode: null,
      rallyeId: null,
      setToken: (token) => set({ token }),
      setRallye: (code, id = null) => set({ rallyeCode: code, rallyeId: id }),
      leave: () => set({ token: null, rallyeCode: null, rallyeId: null }),
    }),
    { name: 'rallye-session' },
  ),
)
