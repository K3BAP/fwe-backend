import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { useApplyTheme } from '@/lib/theme'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/routes/router'

export default function App() {
  useApplyTheme()
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
