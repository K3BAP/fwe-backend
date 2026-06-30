import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type FilterPillProps = SelectHTMLAttributes<HTMLSelectElement> & {
  /** Hebt die Pille hervor, wenn ein Filter aktiv ist (Wert ≠ Default). */
  active?: boolean
}

/**
 * Kompakter Pill-Dropdown der Filterleiste (02-flugtreffen.md §6). Nativer `<select>` mit Pill-Chrom +
 * Chevron — barrierearm und ohne eigene Dropdown-Logik. Aktiv = Sky-Akzent.
 */
export function FilterPill({ active, className, children, ...props }: FilterPillProps) {
  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full border text-[13px] font-semibold transition-colors duration-200',
        active
          ? 'border-transparent bg-sky-50 text-sky-700'
          : 'border-base-300 bg-base-100 text-base-content/80 hover:bg-base-200',
      )}
    >
      <select
        className={cn('cursor-pointer appearance-none bg-transparent py-1.5 pl-3.5 pr-8 outline-none', className)}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 size-3 opacity-70"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  )
}
