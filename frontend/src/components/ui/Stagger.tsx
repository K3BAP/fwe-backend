import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { staggerContainer, staggerItem } from '@/lib/motion'

/**
 * Gestaffeltes Erscheinen einer Liste **nur beim ersten Mount**: Die Eingangs-Animation läuft einmal,
 * wenn der Container montiert (z.B. Skeleton→Inhalt). Beim 20-s-Hintergrund-Poll bleibt der Container
 * montiert und React gleicht Items über `key={id}` ab → bereits sichtbare Zeilen animieren **nicht**
 * erneut; nur neu eingetroffene Keys blenden ein. Respektiert `prefers-reduced-motion`.
 */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      variants={staggerContainer()}
      initial={reduce ? false : 'hidden'}
      animate="show"
    >
      {children}
    </motion.div>
  )
}

/**
 * Einzelnes Listen-Item für {@link Stagger}. Setzt **bewusst kein** `initial`/`animate` — es erbt den
 * Variant-Zustand vom Container (so greift sowohl die Staffelung als auch das Reduce-Abschalten). Das
 * `className` trägt die bestehenden Grid-/Zellen-Klassen.
 */
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={staggerItem}>
      {children}
    </motion.div>
  )
}
