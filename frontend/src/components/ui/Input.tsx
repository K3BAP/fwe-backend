import { useId, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
}

/** Eingabefeld (Design-System §05): Radius 14, 1.5px-Border, Sky-Fokusring. */
export function TextField({ label, error, className, id, ...props }: TextFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-base-content/70">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'w-full rounded-[14px] border-[1.5px] bg-base-100 px-3.5 py-3 text-[15px] outline-none transition',
          'placeholder:text-base-content/40 focus:border-primary focus:ring-4 focus:ring-primary/15',
          error ? 'border-error' : 'border-base-300',
          className,
        )}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  )
}
