import { Button } from './Button'

/**
 * Schlichter Offset-Pager für serverseitig paginierte Listen. Rendert nichts, wenn alles auf eine
 * Seite passt. `page` ist 1-basiert.
 */
export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null

  return (
    <div className="flex items-center justify-between gap-3">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Zurück
      </Button>
      <span className="text-sm text-base-content/60">
        Seite {page} von {pages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Weiter →
      </Button>
    </div>
  )
}
