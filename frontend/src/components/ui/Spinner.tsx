import { cn } from '@/lib/cn'

const SIZE = { sm: 'loading-sm', md: 'loading-md', lg: 'loading-lg' } as const

/** Lade-Spinner (DaisyUI), Sky-getönt. */
export function Spinner({ size = 'md', className }: { size?: keyof typeof SIZE; className?: string }) {
  return <span className={cn('loading loading-spinner text-primary', SIZE[size], className)} />
}
