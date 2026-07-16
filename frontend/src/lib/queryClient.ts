import { QueryClient } from '@tanstack/react-query'

/**
 * Zentrale TanStack-Query-Instanz. Server-Daten leben ausschließlich hier
 * (Zustand hält nur UI-/Session-State, ADR-001 / 05-frontend.md §3).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
