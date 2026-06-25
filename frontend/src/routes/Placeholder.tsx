/** Platzhalter für Routen, die in späteren Meilensteinen entstehen. */
export function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl">{title}</h1>
      <p className="text-base-content/60">Diese Seite entsteht in einem späteren Meilenstein.</p>
    </div>
  )
}
