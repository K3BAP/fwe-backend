import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/cn'
import { useToastStore, type ToastVariant } from '@/stores/toastStore'

const STYLE: Record<ToastVariant, string> = {
  success: 'border-success/30 bg-success/12 text-success',
  error: 'border-error/30 bg-error/12 text-error',
  info: 'border-primary/30 bg-primary/12 text-primary',
}

/** Globaler Toast-Host (in der AppShell montiert). Rendert den Toast-Store animiert (Framer Motion). */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className={cn(
              'pointer-events-auto rounded-full border px-4 py-2.5 text-sm font-semibold shadow-popover backdrop-blur',
              STYLE[t.variant],
            )}
          >
            {t.message}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}
