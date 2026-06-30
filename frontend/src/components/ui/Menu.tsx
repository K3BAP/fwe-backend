import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { MoreIcon } from '@/components/layout/icons'
import { Popover } from './Popover'

export type MenuItemDef = { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean }

/** Kebab-Dropdown (⋮) für Kontext-Aktionen (Mitglieder, Posts, Nachrichten, Channels). */
export function Menu({ items, label = 'Aktionen', trigger }: { items: MenuItemDef[]; label?: string; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={label} onClick={() => setOpen((o) => !o)} className="btn btn-circle btn-ghost btn-sm">
        {trigger ?? <MoreIcon size={18} />}
      </button>
      <Popover open={open} origin="top-right" className="absolute right-0 z-30 mt-1 min-w-44 rounded-2xl border border-base-300 bg-base-100 p-1 shadow-popover">
        {items.map((it, i) => (
          <button
            key={i}
            type="button"
            disabled={it.disabled}
            onClick={() => {
              setOpen(false)
              it.onSelect()
            }}
            className={cn(
              'block w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-base-200 disabled:opacity-40',
              it.danger ? 'text-error' : 'text-base-content',
            )}
          >
            {it.label}
          </button>
        ))}
      </Popover>
    </div>
  )
}
