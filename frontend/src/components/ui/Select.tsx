import { useId, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { Field } from './FormField'
import { fieldControlClass } from './fieldControl'

export type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  error?: string
}

/** Auswahlfeld auf dem geteilten Feld-Gerüst (Optik wie TextField). */
export function SelectField({ label, error, className, id, children, ...props }: SelectFieldProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <Field label={label} error={error} htmlFor={selectId}>
      <select
        id={selectId}
        className={cn(fieldControlClass(error), 'cursor-pointer appearance-none pr-9', className)}
        aria-invalid={error ? true : undefined}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%235B6B7E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.75rem center',
        }}
        {...props}
      >
        {children}
      </select>
    </Field>
  )
}
