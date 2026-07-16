import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Platzhalter-Block für Lade-Zustände (Design-System: weiche Pulsanimation auf base-300). */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-box bg-base-300', className)} {...props} />
}
