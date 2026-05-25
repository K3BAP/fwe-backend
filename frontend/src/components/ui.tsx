import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'
import { useTheme, type ThemeMode } from '../store/theme'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300 dark:disabled:bg-brand-900',
  secondary: 'bg-surface text-fg border border-line hover:bg-surface-2 disabled:opacity-50',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:bg-red-300',
  ghost: 'bg-transparent text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950',
}

type ButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  variant?: Variant
  loading?: boolean
  children?: ReactNode
}

export function Button({ variant = 'primary', loading = false, className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading && <Spinner className="h-5 w-5 border-current/30 border-t-current" />}
      {children}
    </motion.button>
  )
}

export function Card({
  children,
  className = '',
  interactive = false,
}: {
  children: ReactNode
  className?: string
  interactive?: boolean
}) {
  const base = 'rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line'
  if (interactive) {
    return (
      <motion.div
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className={`${base} ${className}`}
      >
        {children}
      </motion.div>
    )
  }
  return <div className={`${base} ${className}`}>{children}</div>
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-fg outline-none transition-colors placeholder:text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 ${className}`}
      {...rest}
    />
  )
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-fg outline-none transition-colors placeholder:text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 ${className}`}
      {...rest}
    />
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-sm font-medium text-fg">{children}</label>
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand-600 ${className}`}
      role="status"
      aria-label="Lädt"
    />
  )
}

export function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-full items-center justify-center p-6">{children}</div>
}

/** Platzhalter mit Schimmer-Effekt für Ladezustände. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-surface-2 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-black/5 to-transparent dark:via-white/5" />
    </div>
  )
}

type BadgeTone = 'gray' | 'green' | 'red' | 'amber' | 'indigo'
const tones: Record<BadgeTone, string> = {
  gray: 'bg-surface-2 text-muted ring-1 ring-line',
  green: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  indigo: 'bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-300',
}

export function Badge({ tone = 'gray', pulse = false, children }: { tone?: BadgeTone; pulse?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {pulse && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {children}
    </span>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p className="text-sm font-medium text-red-600 dark:text-red-400">{children}</p>
}

/** Umschalter Hell/Dunkel/System. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const mode = useTheme((s) => s.mode)
  const setMode = useTheme((s) => s.setMode)
  const next: Record<ThemeMode, ThemeMode> = { light: 'dark', dark: 'system', system: 'light' }
  const label: Record<ThemeMode, string> = { light: 'Hell', dark: 'Dunkel', system: 'System' }

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9, rotate: -15 }}
      onClick={() => setMode(next[mode])}
      title={`Design: ${label[mode]}`}
      aria-label={`Design umschalten (aktuell ${label[mode]})`}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-current/80 transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${className}`}
    >
      {mode === 'dark' ? <MoonIcon /> : mode === 'light' ? <SunIcon /> : <SystemIcon />}
    </motion.button>
  )
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}

function SystemIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}
