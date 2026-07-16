import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/cn'
import { scaleIn } from '@/lib/motion'

export type PopoverOrigin = 'top-right' | 'top-left' | 'top' | 'bottom'

/**
 * Transform-Ursprung, aus dem das Pop-in wächst. `origin` benennt direkt die Kante/Ecke: ein nach
 * **unten** öffnendes Dropdown skaliert aus `top`, ein nach **oben** öffnendes aus `bottom`.
 */
const ORIGIN: Record<PopoverOrigin, string> = {
  'top-right': 'origin-top-right',
  'top-left': 'origin-top-left',
  top: 'origin-top',
  bottom: 'origin-bottom',
}

export type PopoverProps = {
  open: boolean
  origin?: PopoverOrigin
  className?: string
  children: ReactNode
}

/**
 * Animierte Popover-/Dropdown-Fläche (Scale+Fade, origin-bewusst) mit Ein-/Ausgangs-Animation über
 * {@link AnimatePresence}. **Nur die Fläche** ist hier gekapselt — Positionierung, Offen-Zustand und
 * Außenklick/Escape bleiben beim Aufrufer (Menu/UserPicker/ReactionBar/…), da diese sich unterscheiden.
 * Respektiert `prefers-reduced-motion` (dann hartes Ein-/Ausblenden ohne Bewegung).
 */
export function Popover({ open, origin = 'top-left', className, children }: PopoverProps) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={cn(ORIGIN[origin], className)}
          variants={scaleIn()}
          initial={reduce ? false : 'hidden'}
          animate="show"
          exit={reduce ? { opacity: 0, transition: { duration: 0 } } : 'exit'}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
