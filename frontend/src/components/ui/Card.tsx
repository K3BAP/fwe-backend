import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Großzügige Card (Design-System §07): runde Ecken, Border, weicher Schatten. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-box border border-base-300 bg-base-100 shadow-card', className)} {...props} />
}
