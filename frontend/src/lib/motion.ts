import { useReducedMotion } from 'motion/react'
import type { Transition, Variants } from 'motion/react'

/**
 * Zentrales Bewegungs-Vokabular (Motion-Overhaul). **Eine** Quelle für Springs, Dauern, Easing und
 * Variant-Fabriken — Komponenten importieren hier, statt Werte inline zu duplizieren. Alle Werte sind
 * auf einen ruhigen, „balanced & smooth"-Charakter abgestimmt: hohe Dämpfung ⇒ weiches Einschwingen
 * ohne sichtbares Überschwingen. Reines, Hook-freies Modul (außer {@link useMotionConfig}), damit die
 * Presets tree-shakebar bleiben.
 */

/** Ruhiges Ease-Out (cubic-bezier) für alle Tweens. */
export const EASE_OUT: [number, number, number, number] = [0.22, 0.61, 0.36, 1]

/** Standard-Dauern (Sekunden). */
export const DUR = { fast: 0.18, base: 0.26, slow: 0.4 } as const

/**
 * Spring-Presets — bewusst sanft (kaum/kein Overshoot). `badge` ist gegenüber dem früheren 600/18
 * deutlich entschärft (Dämpfungsverhältnis ≈ 0.62 statt 0.37 ⇒ weicher „Bump" statt Hüpfen).
 */
export const spring = {
  /** Overlays: Modal-Panel, Drawer, Popover, Notification-Center. Praktisch ohne Überschwingen. */
  overlay: { type: 'spring', stiffness: 320, damping: 34, mass: 0.9 },
  /** Layout-Bewegungen: Aktiv-Indikatoren (SegmentedControl, BottomNav). */
  gentle: { type: 'spring', stiffness: 260, damping: 30 },
  /** Zähler-Badges (sanfter Bump beim Hochzählen). */
  badge: { type: 'spring', stiffness: 420, damping: 26 },
  /** Toasts. */
  toast: { type: 'spring', stiffness: 340, damping: 32 },
} satisfies Record<string, Transition>

/** Tween-Presets auf Basis von {@link EASE_OUT}. */
export const tween = {
  base: { duration: DUR.base, ease: EASE_OUT },
  fast: { duration: DUR.fast, ease: EASE_OUT },
} satisfies Record<string, Transition>

// ── Variant-Fabriken ──────────────────────────────────────────────────────────

/** Reines Ein-/Ausblenden. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: tween.base },
  exit: { opacity: 0, transition: tween.base },
}

/** Ein-/Ausblenden mit leichtem Versatz nach oben. */
export const fadeUp = (y = 8): Variants => ({
  hidden: { opacity: 0, y },
  show: { opacity: 1, y: 0, transition: tween.base },
  exit: { opacity: 0, y: y / 2, transition: tween.base },
})

/** Pop-in für Popover/Menüs: Skalieren + Fade aus dem Ursprung (origin-* per CSS am Aufrufer). */
export const scaleIn = (origin = 0.96): Variants => ({
  hidden: { opacity: 0, scale: origin, y: -6 },
  show: { opacity: 1, scale: 1, y: 0, transition: spring.overlay },
  exit: { opacity: 0, scale: origin, y: -6, transition: tween.fast },
})

/** Ein-/ausfahrendes Panel (Drawer/Bottom-Sheet) — von rechts oder von unten. */
export const slideIn = (side: 'right' | 'bottom'): Variants =>
  side === 'right'
    ? {
        hidden: { x: '100%' },
        show: { x: 0, transition: spring.overlay },
        exit: { x: '100%', transition: spring.overlay },
      }
    : {
        hidden: { y: '100%' },
        show: { y: 0, transition: spring.overlay },
        exit: { y: '100%', transition: spring.overlay },
      }

// ── Listen-Stagger (nur beim ersten Mount, nie beim Hintergrund-Poll) ──────────

/**
 * Container-Variants für gestaffeltes Erscheinen einer Liste. Orchestriert nur Kinder, die beim Mount
 * von `hidden`→`show` wechseln — nachgeladene (gleicher Key) Items animieren nicht erneut.
 */
export const staggerContainer = (stagger = 0.04, delay = 0.02): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
})

/** Item-Variants für {@link staggerContainer}. Nur Opacity+Y (kein `layout` ⇒ kein Reflow-Geruckel). */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: tween.base },
}

// ── Reduce-bewusster Helfer ───────────────────────────────────────────────────

/**
 * Liefert reduce-bewusste Props für eine Variants-basierte Komponente: bei `prefers-reduced-motion`
 * wird `initial` übersprungen (`false`), sodass kein Eingangs-Tween läuft. So bleiben Aufrufer
 * Einzeiler (`<motion.div {...cfg} variants={…} />`).
 */
export function useMotionConfig() {
  const reduce = useReducedMotion()
  return {
    reduce,
    initial: reduce ? (false as const) : 'hidden',
    animate: 'show',
    exit: 'exit',
  } as const
}
