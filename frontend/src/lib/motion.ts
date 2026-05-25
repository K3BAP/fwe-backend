import type { Transition, Variants } from 'motion/react'

/**
 * Zentrale Bewegungs-Presets. Alle Animationen der App leiten sich hieraus ab,
 * damit Timing und Gefühl einheitlich bleiben. Es werden nur transform/opacity
 * animiert (60fps-freundlich).
 */

export const spring: Transition = { type: 'spring', stiffness: 380, damping: 32 }
export const springSoft: Transition = { type: 'spring', stiffness: 220, damping: 26 }
export const ease: Transition = { duration: 0.22, ease: [0.22, 1, 0.36, 1] }

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: ease },
}

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: ease },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: spring },
}

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: ease },
}

export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: ease },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } },
}
