import { Outlet, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { fade } from '@/lib/motion'

/**
 * Rahmen für die Gast-Routen (Landing/Login/Register, ohne App-Chrome). Jeder Routenwechsel blendet die
 * Seite weich ein — **reines Opacity-Fade**, damit die `fixed` Landing-Nav nicht durch eine Transform-
 * Hülle ihren Viewport-Bezug verliert. Enter-only (kein AnimatePresence): der Data-Router committet
 * Navigationen synchron, ein sauberes Exit ist damit nicht möglich. Respektiert `prefers-reduced-motion`.
 */
export function GuestLayout() {
  const reduce = useReducedMotion()
  const { pathname } = useLocation()
  return (
    <motion.div key={pathname} variants={fade} initial={reduce ? false : 'hidden'} animate="show">
      <Outlet />
    </motion.div>
  )
}
