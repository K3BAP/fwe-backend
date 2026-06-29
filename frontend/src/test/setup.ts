// Globales Test-Setup: registriert die jest-dom-Matcher (toBeInTheDocument …) für Vitest
// und erweitert dabei `expect` typseitig. Wird via vitest.config.ts `setupFiles` geladen.
import '@testing-library/jest-dom/vitest'
