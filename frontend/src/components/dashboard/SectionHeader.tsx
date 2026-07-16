import { Link } from 'react-router-dom'

/** Abschnitts-Kopf mit Titel und optionalem „Alle ansehen"-Link. */
export function SectionHeader({
  title,
  to,
  actionLabel = 'Alle ansehen',
}: {
  title: string
  to?: string
  actionLabel?: string
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-xl">{title}</h2>
      {to && (
        <Link to={to} className="shrink-0 text-sm font-semibold text-primary hover:underline">
          {actionLabel} →
        </Link>
      )}
    </div>
  )
}
