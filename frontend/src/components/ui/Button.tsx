import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'accent' | 'secondary' | 'outline' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary: 'btn-primary shadow-[0_8px_18px_rgba(30,144,230,.3)]',
  accent: 'btn-accent',
  secondary: 'btn-secondary',
  outline: 'btn-outline border-[1.5px] border-base-300 text-primary',
  ghost: 'btn-ghost text-primary',
}
const SIZE: Record<Size, string> = { sm: 'btn-sm', md: '', lg: 'btn-lg' }

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
}

/** Pille-Button auf DaisyUI-Basis (Design-System §05). `transition` (inkl. transform) + `active:scale`
 *  geben ein weiches Druck-Feedback; bei reduzierter Bewegung neutralisiert die globale CSS-Regel das. */
export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn('btn rounded-full transition duration-200 active:scale-[.97]', VARIANT[variant], SIZE[size], className)}
      {...props}
    />
  )
}
