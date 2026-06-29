import { Outlet, useLocation } from 'react-router-dom'
import { Toaster } from '@/components/ui'
import { cn } from '@/lib/cn'
import { BottomNav } from './BottomNav'
import { PageTransition } from './PageTransition'
import { TopBar } from './TopBar'

/** Routen, die das volle Fenster füllen (eigenes Scrolling je Spalte) statt im zentrierten Container zu laufen. */
function isFullBleed(path: string): boolean {
  return path === '/flugtreffen' || path === '/chat' || path.startsWith('/chat/')
}

/**
 * App-Rahmen: Top-Bar + Content (Outlet) + mobile Bottom-Nav + Toast-Host. Die meisten Seiten laufen im
 * zentrierten, scrollenden Container. **Full-bleed-Routen** (z.B. die Flugtreffen-Karte+Liste oder der
 * Chat als Vollbild-2-Spalter) füllen stattdessen die volle Höhe — der Shell wird dann selbst nicht
 * gescrollt, die Spalten scrollen einzeln.
 */
export function AppShell() {
  const fullBleed = isFullBleed(useLocation().pathname)

  return (
    <div className={cn('flex flex-col bg-base-200 text-base-content', fullBleed ? 'h-[100svh] overflow-hidden' : 'min-h-svh')}>
      <TopBar />
      {fullBleed ? (
        <main className="min-h-0 flex-1">
          <Outlet />
        </main>
      ) : (
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-28 sm:px-5 sm:py-8 md:pb-10">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      )}
      <BottomNav />
      <Toaster />
    </div>
  )
}
