import { useId, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/cn'
import { useDialogA11y } from '@/lib/useDialogA11y'

export type ModalProps = {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  /** Optionale Aktionsleiste am unteren Rand. */
  footer?: ReactNode
  className?: string
}

/**
 * Zentriertes, animiertes Dialogfenster mit Backdrop. Escape/Scroll-Lock, Fokus-Falle und
 * Fokus-Rückgabe kommen aus {@link useDialogA11y} (Design-System §Sheet, M6 a11y-Pass).
 */
export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useDialogA11y(open, onClose, panelRef)

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <motion.div
            className="absolute inset-0 bg-[rgba(14,23,38,.5)] backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            className={cn(
              'relative w-full max-w-md rounded-[28px] border border-base-300 bg-base-100 p-6 shadow-popover focus:outline-none',
              className,
            )}
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            {title && <h2 id={titleId} className="mb-3 pr-8 font-display text-xl">{title}</h2>}
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-base-content/50 transition hover:bg-base-200 hover:text-base-content"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
            {children}
            {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
