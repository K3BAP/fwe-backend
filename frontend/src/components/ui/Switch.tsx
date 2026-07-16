import { cn } from '@/lib/cn'

/** Schalter (DaisyUI-Toggle, Sky) mit optionalem Label. */
export function Switch({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label?: string
  className?: string
}) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2.5 select-none', className)}>
      <input
        type="checkbox"
        className="toggle toggle-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label && <span className="text-sm font-medium">{label}</span>}
    </label>
  )
}
