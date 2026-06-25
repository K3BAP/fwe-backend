/**
 * Prototyp-zuerst (ADR-016): In M1 wird die UI gegen **Mock-Daten** gebaut; ab M2 wird pro Domäne
 * hinter der Daten-Naht (api/*) auf echtes `fetch` umgestellt — die UI bleibt unverändert.
 */
export const USE_MOCKS = true

/** Künstliche Mock-Latenz (ms), um Lade-/Skeleton-Zustände erlebbar zu machen. */
export const MOCK_LATENCY = 250
