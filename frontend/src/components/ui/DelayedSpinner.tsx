import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/cn'
import { tween } from '@/lib/motion'
import { Spinner } from './Spinner'

/**
 * Lade-Spinner, der erst nach `delay` ms erscheint und dann sanft einblendet. Verhindert das harte
 * Aufblitzen eines Spinners bei schnellen Ladevorgängen (bereits gecachte Lazy-Chunks zeigen gar
 * keinen Spinner mehr). `className` setzt die Hülle (Höhe/Hintergrund). Respektiert reduzierte Bewegung.
 */
export function DelayedSpinner({ delay = 150, className }: { delay?: number; className?: string }) {
  const reduce = useReducedMotion()
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setShow(true), delay)
    return () => window.clearTimeout(t)
  }, [delay])
  if (!show) return null
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={tween.base}
      className={cn('grid place-items-center', className)}
    >
      <Spinner size="lg" />
    </motion.div>
  )
}
