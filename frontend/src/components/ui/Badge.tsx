import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { ExperienceLevel, MeetupStatus } from '@/api/schemas'

export type { ExperienceLevel, MeetupStatus }

/** Semantische Pillen-Tönung über DaisyUI-Tokens (theme-adaptiv hell+dunkel). */
export type PillTone = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral'

const TONE_CLASS: Record<PillTone, string> = {
  primary: 'bg-primary/12 text-primary',
  secondary: 'bg-secondary/12 text-secondary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  error: 'bg-error/15 text-error',
  neutral: 'bg-base-content/10 text-base-content/70',
}

/**
 * Generische Tint-Pille mit optionalem Punkt (Design-System §06). Zwei Modi:
 * - `tone` → semantische DaisyUI-Tokens (theme-adaptiv) — bevorzugt für Status/Hinweise.
 * - `bg`/`fg` → feste Identitätsfarben, wenn kein Token passt (z.B. Erfahrungslevel).
 *
 * `dot`: Farb-String (eigene Punktfarbe) oder `true` (übernimmt die Text-/Tone-Farbe via `currentColor`).
 */
export function Pill({
  tone,
  bg,
  fg,
  dot,
  className,
  children,
}: {
  tone?: PillTone
  bg?: string
  fg?: string
  dot?: string | boolean
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold', tone && TONE_CLASS[tone], className)}
      style={tone ? undefined : { background: bg, color: fg }}
    >
      {dot && <span className="size-1.5 rounded-full" style={{ background: typeof dot === 'string' ? dot : 'currentColor' }} />}
      {children}
    </span>
  )
}

type Tone = { label: string; bg: string; fg: string; dot: string }

/** Erfahrungslevel (DATA_MODEL §3.1.1) → Label + Farben. */
const EXPERIENCE: Record<ExperienceLevel, Tone> = {
  beginner: { label: 'Anfänger', bg: '#E4F6EC', fg: '#157A43', dot: '#1E9E5A' },
  advanced: { label: 'Fortgeschritten', bg: '#E5F1FD', fg: '#0C5896', dot: '#1E90E6' },
  expert: { label: 'Experte', bg: '#FFE1D8', fg: '#C7421F', dot: '#FF6B4A' },
  all: { label: 'Alle Level', bg: '#E8F3F4', fg: '#0A4F57', dot: '#117D87' },
}

export function ExperienceBadge({ level }: { level: ExperienceLevel }) {
  const t = EXPERIENCE[level]
  return <Pill bg={t.bg} fg={t.fg} dot={t.dot}>{t.label}</Pill>
}

/** Abgeleiteter Treffen-Status (DATA_MODEL §4.2.1) → Label + Farben. */
const STATUS: Record<MeetupStatus, Tone> = {
  open: { label: 'Offen', bg: '#E4F6EC', fg: '#157A43', dot: '#1E9E5A' },
  full: { label: 'Ausgebucht', bg: '#FBF0D6', fg: '#8A5D00', dot: '#E8A21A' },
  cancelled: { label: 'Abgesagt', bg: '#FCE6E7', fg: '#B42318', dot: '#E5484D' },
  finished: { label: 'Beendet', bg: '#EEF3F9', fg: '#5B6B7E', dot: '#94A3B5' },
}

export function StatusBadge({ status, className }: { status: MeetupStatus; className?: string }) {
  const t = STATUS[status]
  return <Pill bg={t.bg} fg={t.fg} dot={t.dot} className={className}>{t.label}</Pill>
}
