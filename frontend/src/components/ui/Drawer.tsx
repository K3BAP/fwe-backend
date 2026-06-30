import { useId, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/cn'
import { slideIn, tween } from '@/lib/motion'
import { useDialogA11y } from '@/lib/useDialogA11y'

type Side = 'right' | 'bottom'

const PANEL: Record<Side, string> = {
  right: 'inset-y-0 right-0 h-full w-full max-w-sm rounded-l-[28px]',
  bottom: 'inset-x-0 bottom-0 max-h-[85vh] w-full rounded-t-[28px]',
}

export type DrawerProps = {
  open: boolean
  onClose: () => void
  side?: Side
  title?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Ein-/ausfahrendes Panel (rechts = Desktop, unten = mobiles Bottom-Sheet) mit Backdrop.
 * Escape/Scroll-Lock, Fokus-Falle und Fokus-Rückgabe kommen aus {@link useDialogA11y} (M6 a11y-Pass).
 */
export function Drawer({ open, onClose, side = 'right', title, children, className }: DrawerProps) {
  const panelRef = useRef<HTMLElement>(null)
  const titleId = useId()
  const reduce = useReducedMotion()
  useDialogA11y(open, onClose, panelRef)

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-[rgba(14,23,38,.5)] backdrop-blur-sm"
            onClick={onClose}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: reduce ? { duration: 0 } : tween.base }}
          />
          <motion.aside
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            className={cn('absolute border border-base-300 bg-base-100 p-6 shadow-popover focus:outline-none', PANEL[side], className)}
            variants={slideIn(side)}
            initial={reduce ? false : 'hidden'}
            animate="show"
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : 'exit'}
          >
            {title && <h2 id={titleId} className="mb-4 font-display text-xl">{title}</h2>}
            {children}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
