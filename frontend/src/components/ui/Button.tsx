import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'accent' | 'secondary' | 'outline' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary: 'btn-primary shadow-[0_8px_18px_rgba(30,144,230,.3)]',
  accent: 'btn-accent',
  secondary: 'btn-secondary',
  outline: 'btn-outline border-[1.5px] border-base-300 text-sky-700',
  ghost: 'btn-ghost text-sky-700',
}
const SIZE: Record<Size, string> = { sm: 'btn-sm', md: '', lg: 'btn-lg' }

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
}

/** Pille-Button auf DaisyUI-Basis (Design-System §05). */
export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return <button className={cn('btn rounded-full', VARIANT[variant], SIZE[size], className)} {...props} />
}
