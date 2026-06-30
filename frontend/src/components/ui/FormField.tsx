import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/cn'
import { fadeUp } from '@/lib/motion'

/**
 * Geteiltes Feld-Gerüst für TextField/Select/Textarea (Label + Fehlertext), damit die drei
 * Form-Controls dieselbe Optik teilen, ohne sie zu duplizieren (ADR-013). Die Control-Optik selbst
 * liegt in {@link ./fieldControl}.
 */
export function Field({
  label,
  error,
  htmlFor,
  className,
  children,
}: {
  label?: string
  error?: string
  htmlFor?: string
  className?: string
  children: ReactNode
}) {
  const reduce = useReducedMotion()
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-semibold text-base-content/70">
          {label}
        </label>
      )}
      {children}
      <AnimatePresence>
        {error && (
          <motion.span
            key="error"
            className="text-xs text-error"
            variants={fadeUp(4)}
            initial={reduce ? false : 'hidden'}
            animate="show"
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : 'exit'}
          >
            {error}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
