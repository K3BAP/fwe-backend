import { Link } from 'react-router-dom'

/** Platzhalter-Startseite. Das echte Dashboard (eigene/empfohlene Treffen + Gruppen) folgt in M1. */
export function Home() {
  return (
    <div className="flex flex-col gap-6">
      <div className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
        Willkommen
      </div>
      <div>
        <h1 className="text-4xl">Gemeinsam abheben.</h1>
        <p className="mt-2 max-w-xl text-base-content/60">
          Finde deine nächste Thermik – gemeinsam fliegen. Das Dashboard mit aktuellen Flugtreffen und
          deinen Gruppen entsteht im nächsten Meilenstein (M1).
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          to="/flugtreffen"
          className="btn btn-primary rounded-full shadow-[0_8px_18px_rgba(30,144,230,.3)]"
        >
          Flugtreffen entdecken
        </Link>
        <Link
          to="/styleguide"
          className="btn btn-outline rounded-full border-[1.5px] border-base-300 text-sky-700"
        >
          Design-Styleguide
        </Link>
      </div>
    </div>
  )
}
