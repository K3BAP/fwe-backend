import { useId, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { Field } from './FormField'
import { fieldControlClass } from './fieldControl'

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
}

/** Eingabefeld (Design-System §05): Radius 14, 1.5px-Border, Sky-Fokusring. */
export function TextField({ label, error, className, id, ...props }: TextFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <Field label={label} error={error} htmlFor={inputId}>
      <input
        id={inputId}
        className={cn(fieldControlClass(error), className)}
        aria-invalid={error ? true : undefined}
        {...props}
      />
    </Field>
  )
}
