import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useLocation } from 'react-router-dom'

/**
 * Dezenter Seitenwechsel-Effekt (M6): der Inhalt blendet bei jedem Routenwechsel kurz ein
 * (Fade + leichter Versatz). Über den `pathname`-Key wird der Inhalt bei Navigation neu
 * gemountet → die Eingangsanimation spielt erneut. Respektiert `prefers-reduced-motion`
 * (dann ohne Bewegung). Kein Exit (kein AnimatePresence) → keine Konflikte mit Router/Suspense.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion()
  const { pathname } = useLocation()

  return (
    <motion.div
      key={pathname}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
