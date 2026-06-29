import { useEffect, type RefObject } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Gemeinsame Dialog-Barrierefreiheit für Modal/Drawer (M6 a11y-Pass):
 * - Escape schließt,
 * - Body-Scroll-Lock, solange offen,
 * - der Fokus wandert beim Öffnen in das Panel und kehrt beim Schließen zum auslösenden Element zurück,
 * - Tab bleibt zyklisch im Panel gefangen (Fokus-Falle).
 *
 * Generisch über das Panel-Element, damit sowohl ein `div` (Modal) als auch ein `aside` (Drawer)
 * ihren typisierten Ref ohne Cast übergeben können. Das Panel braucht `tabindex={-1}`.
 */
export function useDialogA11y<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
  panelRef: RefObject<T | null>,
): void {
  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const panel = panelRef.current
      if (panel === null) return

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
      if (items.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus() // neutraler Start am Panel; Tab springt von hier zum ersten Element

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus()
    }
  }, [open, onClose, panelRef])
}
