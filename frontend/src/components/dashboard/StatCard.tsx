import type { ReactNode } from 'react'
import { Card } from '@/components/ui'
import { cn } from '@/lib/cn'

/**
 * Kennzahl-Card fürs Dashboard (Prototyp-Stil: großer farbiger Wert + Label, ohne Icon).
 * `valueClassName` setzt die Wertfarbe; `className` steuert die Card (z.B. `hidden lg:block`).
 */
export function StatCard({
  value,
  label,
  valueClassName,
  className,
}: {
  value: ReactNode
  label: string
  valueClassName?: string
  className?: string
}) {
  return (
    <Card className={cn('p-4 sm:p-[18px]', className)}>
      <div className={cn('whitespace-nowrap font-display text-2xl font-extrabold leading-none sm:text-[26px]', valueClassName)}>
        {value}
      </div>
      <div className="mt-1.5 text-xs text-base-content/55 sm:text-[13px]">{label}</div>
    </Card>
  )
}
