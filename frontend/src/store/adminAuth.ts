import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AdminUserInfo {
  id: number
  username: string
}

interface AdminAuthState {
  token: string | null
  admin: AdminUserInfo | null
  login: (token: string, admin: AdminUserInfo) => void
  logout: () => void
}

export const useAdminAuth = create<AdminAuthState>()(
  persist(
    (set) => ({
      token: null,
      admin: null,
      login: (token, admin) => set({ token, admin }),
      logout: () => set({ token: null, admin: null }),
    }),
    { name: 'rallye-admin' },
  ),
)
