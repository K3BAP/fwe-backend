import { useId, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { Field } from './FormField'
import { fieldControlClass } from './fieldControl'

export type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  error?: string
}

/** Mehrzeiliges Eingabefeld auf dem geteilten Feld-Gerüst. */
export function TextareaField({ label, error, className, id, rows = 4, ...props }: TextareaFieldProps) {
  const autoId = useId()
  const textareaId = id ?? autoId
  return (
    <Field label={label} error={error} htmlFor={textareaId}>
      <textarea
        id={textareaId}
        rows={rows}
        className={cn(fieldControlClass(error), 'resize-y leading-relaxed', className)}
        aria-invalid={error ? true : undefined}
        {...props}
      />
    </Field>
  )
}
