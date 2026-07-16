import type { ReactNode } from 'react'

/**
 * Tabellen-Bausteine. Bewusst **keine** generische `DataTable` mit `columns`/`render`-DSL: die würde
 * fünf Tabellen zwar DRY machen, tauscht dafür aber flaches, lesbares JSX gegen Render-Props plus
 * Generics — genau die „Cleverness", die ADR-013 der Lesbarkeit unterordnet. Geteilt wird nur, was
 * wirklich mehrfach identisch vorkommt: der Rahmen und der Sort-Header.
 */

/** Rahmen inkl. horizontalem Scroll auf schmalen Viewports. Innen bleibt gewöhnliches thead/tbody. */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
      <table className="table">{children}</table>
    </div>
  )
}

/**
 * Sortierbarer Header: rendert einen Button, wenn `onSort` gesetzt ist, sonst reinen Text.
 * Treibt den **serverseitigen** `sort`-Parameter — hier wird nichts lokal sortiert.
 */
export function SortHeader({
  label,
  sortKey,
  active,
  indicator,
  onSort,
  className,
}: {
  label: string
  sortKey: string
  active: boolean
  indicator: string
  onSort?: (sort: string) => void
  className?: string
}) {
  if (!onSort) {
    return <th className={className}>{label}</th>
  }
  return (
    <th className={className}>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-semibold hover:text-primary"
        onClick={() => onSort(sortKey)}
        aria-pressed={active}
      >
        {label}
        {active && <span aria-hidden>{indicator}</span>}
      </button>
    </th>
  )
}
