import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Geteiltes Feld-Gerüst für TextField/Select/Textarea (Label + Fehlertext), damit die drei
 * Form-Controls dieselbe Optik teilen, ohne sie zu duplizieren (ADR-013). Die Control-Optik selbst
 * liegt in {@link ./fieldControl}.
 */
export function Field({
  label,
  error,
  htmlFor,
  className,
  children,
}: {
  label?: string
  error?: string
  htmlFor?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-semibold text-base-content/70">
          {label}
        </label>
      )}
      {children}
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  )
}
