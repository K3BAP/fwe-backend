import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { fadeInUp, pageVariants, staggerContainer, staggerItem } from '../lib/motion'

/** Seitenübergang: umschließt den Inhalt einer Route. */
export function PageTransition({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit" className={className}>
      {children}
    </motion.div>
  )
}

/** Einfaches Einblenden von unten. */
export function FadeIn({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  )
}

/** Container, dessen direkte <Item>-Kinder nacheinander eingeblendet werden. */
export function Stagger({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  )
}

export function Item({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  )
}

/** Zählt eine Zahl flüssig auf den Zielwert hoch. */
export function CountUp({ value, className = '' }: { value: number; className?: string }) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (reduce) {
      fromRef.current = value
      return
    }
    const from = fromRef.current
    const to = value
    if (from === to) return
    const duration = 500
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, reduce])

  return <span className={className}>{reduce ? value : display}</span>
}
