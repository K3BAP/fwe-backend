import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { useMe } from '@/api/auth'
import { useApplyTheme } from '@/lib/theme'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/routes/router'

/** Lädt einmalig die Session in den authStore (Naht: Mock in M1, echte Shield-Session in M2). */
function SessionBootstrap() {
  useMe()
  return null
}

export default function App() {
  useApplyTheme()
  return (
    <QueryClientProvider client={queryClient}>
      <SessionBootstrap />
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
