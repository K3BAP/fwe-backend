import { useId, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/cn'
import { spring } from '@/lib/motion'

export type SegmentOption<T extends string> = { value: T; label: ReactNode }

/**
 * Segment-Umschalter (Design-System §05): Pillen-Track mit aktiver Pille. Die aktive Pille wandert per
 * `layoutId` weich zwischen den Segmenten (statt hart umzuspringen); die Textfarbe blendet sanft über.
 * Die `layoutId` ist pro Instanz eindeutig ({@link useId}), damit mehrere Controls nicht ineinander
 * animieren. Generisch über den Wert-Typ — z.B. Cards/Tabelle/Karte oder Listen-Filter.
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
  const reduce = useReducedMotion()
  const layoutId = useId()
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
              'relative inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200',
              active ? 'text-base-content' : 'text-base-content/60 hover:text-base-content',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-base-100 shadow-card"
                transition={reduce ? { duration: 0 } : spring.gentle}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
