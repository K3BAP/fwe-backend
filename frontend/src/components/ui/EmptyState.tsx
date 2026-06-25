import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Leerer Zustand: optionales Icon, Titel, Beschreibung und optionale Aktion (Design-System). */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-box border border-base-300 bg-base-100 px-6 py-12 text-center',
        className,
      )}
    >
      {icon && <div className="grid size-14 place-items-center rounded-full bg-base-200 text-primary">{icon}</div>}
      <div>
        <p className="font-display text-lg">{title}</p>
        {description && <p className="mt-1 text-sm text-base-content/60">{description}</p>}
      </div>
      {action}
    </div>
  )
}
