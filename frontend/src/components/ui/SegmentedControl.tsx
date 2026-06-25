import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type SegmentOption<T extends string> = { value: T; label: ReactNode }

/**
 * Segment-Umschalter (Design-System §05): Pillen-Track mit weißer aktiver Pille + Schatten.
 * Generisch über den Wert-Typ — z.B. Cards/Tabelle/Karte oder Listen-Filter.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  'aria-label': ariaLabel,
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  'aria-label'?: string
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('inline-flex gap-1 rounded-full bg-base-200 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition',
              active ? 'bg-base-100 text-base-content shadow-card' : 'text-base-content/60 hover:text-base-content',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
