import { Link } from 'react-router-dom'

/** Catch-all für unbekannte Pfade (Route `*`). */
export function NotFound() {
  return (
    <div className="flex flex-col items-start gap-2">
      <h1 className="text-3xl">Seite nicht gefunden (404)</h1>
      <p className="text-base-content/60">Diese Seite gibt es nicht — vielleicht ist der Link veraltet.</p>
      <Link to="/" className="link link-primary">
        Zur Startseite
      </Link>
    </div>
  )
}
