import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useReducedMotion } from 'motion/react'
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
 *
 * Jeder Routenwechsel blendet weich ein ({@link PageTransition}). Full-bleed nutzt nur ein Überblenden
 * (kein Y-Versatz, `h-full`) und einen **groben Schlüssel** (`/chat`), damit ein Thread-Wechsel innerhalb
 * von `/chat/:id` die Spalten nicht neu mountet. Nicht-full-bleed scrollt bei Navigation sanft nach oben.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const fullBleed = isFullBleed(pathname)
  const reduce = useReducedMotion()

  // Sanftes Zurück-an-den-Anfang bei Navigation (nur normale Routen — Full-bleed scrollt je Spalte selbst).
  useEffect(() => {
    if (fullBleed) return
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }, [pathname, fullBleed, reduce])

  return (
    <div className={cn('flex flex-col bg-base-200 text-base-content', fullBleed ? 'h-[100svh] overflow-hidden' : 'min-h-svh')}>
      <TopBar />
      {fullBleed ? (
        <main className="min-h-0 flex-1">
          <PageTransition opacityOnly routeKey={`/${pathname.split('/')[1]}`}>
            <Outlet />
          </PageTransition>
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
