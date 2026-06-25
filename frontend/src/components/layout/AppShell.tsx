import { Outlet } from 'react-router-dom'
import { Toaster } from '@/components/ui'
import { BottomNav } from './BottomNav'
import { TopBar } from './TopBar'

/** App-Rahmen: Sticky-Top-Bar + Content (Outlet) + mobile Bottom-Nav + globaler Toast-Host. */
export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col bg-base-200 text-base-content">
      <TopBar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-28 sm:px-5 sm:py-8 md:pb-10">
        <Outlet />
      </main>
      <BottomNav />
      <Toaster />
    </div>
  )
}
