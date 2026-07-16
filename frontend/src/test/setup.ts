// Globales Test-Setup: registriert die jest-dom-Matcher (toBeInTheDocument …) für Vitest
// und erweitert dabei `expect` typseitig. Wird via vitest.config.ts `setupFiles` geladen.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Testing-Library hängt sein Auto-Cleanup nur ein, wenn Vitest mit `globals: true` läuft — hier nicht
// (bewusst: explizite Imports). Ohne diesen Hook sammeln sich die Renders mehrerer `it`-Blöcke im
// selben DOM und Queries finden Treffer aus dem vorherigen Test.
afterEach(cleanup)
