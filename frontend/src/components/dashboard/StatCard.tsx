import type { ReactNode } from 'react'
import { Card } from '@/components/ui'

/** Kompakte Kennzahl-Card fürs Dashboard. Vertikal, damit auch 3 Spalten auf 375px passen. */
export function StatCard({ icon, value, label }: { icon: ReactNode; value: ReactNode; label: string }) {
  return (
    <Card className="flex flex-col gap-2 p-3.5">
      <span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-sky-600">{icon}</span>
      <div>
        <div className="whitespace-nowrap font-display text-2xl leading-none">{value}</div>
        <div className="mt-1 text-[11px] leading-tight text-base-content/55">{label}</div>
      </div>
    </Card>
  )
}
