import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useLocation } from 'react-router-dom'
import { fade, fadeUp } from '@/lib/motion'

/**
 * Dezenter Seitenwechsel: der Inhalt blendet bei jedem Routenwechsel ein (Fade, optional mit leichtem
 * Versatz). Über den Key (Routen-Pfad) wird der Inhalt bei Navigation neu gemountet → die
 * Eingangsanimation spielt erneut. **Enter-only** (kein AnimatePresence/Exit) — der Data-Router
 * committet Navigationen synchron, ein sauberes Exit ist damit nicht möglich (und würde die Latenz
 * verdoppeln). Respektiert `prefers-reduced-motion`.
 *
 * - `opacityOnly`: nur Überblenden ohne Y-Versatz und mit `h-full`-Hülle — für **Full-Bleed-Routen**
 *   (Chat/Flugtreffen), deren `h-[100svh]`-Spaltenlayout kein zusätzliches Padding/Translate verträgt.
 * - `routeKey`: erlaubt einen gröberen Schlüssel als den vollen Pfad (z.B. `/chat`), damit ein Wechsel
 *   *innerhalb* von `/chat/:id` die Spalten nicht neu mountet.
 */
export function PageTransition({
  children,
  opacityOnly = false,
  routeKey,
}: {
  children: ReactNode
  opacityOnly?: boolean
  routeKey?: string
}) {
  const reduce = useReducedMotion()
  const { pathname } = useLocation()

  return (
    <motion.div
      key={routeKey ?? pathname}
      className={opacityOnly ? 'h-full min-h-0' : undefined}
      variants={opacityOnly ? fade : fadeUp(8)}
      initial={reduce ? false : 'hidden'}
      animate="show"
    >
      {children}
    </motion.div>
  )
}
