import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useNotificationUnread } from '@/api/notifications'
import { Drawer } from '@/components/ui'
import { spring } from '@/lib/motion'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { BellIcon } from '@/components/layout/icons'
import { NotificationPanel } from './NotificationPanel'

/**
 * Benachrichtigungs-Center an der Glocke: Desktop = verankertes Popover (Außenklick/Escape schließt),
 * Mobil = Bottom-Sheet ({@link Drawer} bringt Backdrop/Scroll-Lock/Fokus-Falle/Escape mit). Beide teilen
 * sich den {@link NotificationPanel}-Inhalt. Ersetzt die frühere Vollbild-Seite `/benachrichtigungen`.
 */
export function NotificationCenter() {
  const unread = useNotificationUnread().data ?? 0
  const reduce = useReducedMotion()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = () => setOpen(false)

  // Außenklick + Escape fürs Desktop-Popover; das mobile Drawer regelt das selbst.
  useEffect(() => {
    if (!open || !isDesktop) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, isDesktop])

  // Badge poppt beim Hochzählen (Key = Wert ⇒ Remount ⇒ erneute Scale-Animation).
  const pop = reduce ? false : { scale: 0.5 }
  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-label="Benachrichtigungen"
      aria-haspopup="dialog"
      aria-expanded={open}
      className="relative btn btn-circle btn-ghost btn-sm"
    >
      <BellIcon size={18} />
      {unread > 0 && (
        <motion.span
          key={unread}
          initial={pop}
          animate={{ scale: 1 }}
          transition={spring.badge}
          className="absolute right-1 top-1 grid h-[16px] min-w-[16px] place-items-center rounded-full bg-coral-500 px-1 text-[9px] font-bold text-white"
        >
          {unread}
        </motion.span>
      )}
    </button>
  )

  // Mobil: Bottom-Sheet. Per Portal an den Body — sonst fängt das `backdrop-blur` der Top-Bar
  // (eigener Containing-Block für `position: fixed`) das Vollbild-Overlay im 56px-Header ein.
  if (!isDesktop) {
    return (
      <>
        {trigger}
        {createPortal(
          <Drawer open={open} onClose={close} side="bottom" className="flex max-h-[85vh] flex-col overflow-hidden p-0">
            <NotificationPanel onClose={close} />
          </Drawer>,
          document.body,
        )}
      </>
    )
  }

  // Desktop: verankertes Popover unter der Glocke.
  return (
    <div ref={ref} className="relative">
      {trigger}
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Benachrichtigungen"
            initial={reduce ? false : { opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -8 }}
            transition={spring.overlay}
            className="absolute right-0 z-40 mt-2 w-[min(24rem,calc(100vw-1.5rem))] origin-top-right overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-popover"
          >
            <NotificationPanel onClose={close} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
