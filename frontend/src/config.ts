/**
 * Prototyp-zuerst (ADR-016): In M1 läuft die UI gegen **Mock-Daten**; ab M2 wird **pro Domäne** hinter
 * der Daten-Naht (api/*) auf echtes `fetch` umgestellt — die UI-Komponenten bleiben unverändert. Jeder
 * Schalter wird in seinem Milestone von `true` (Mock) auf `false` (echtes Backend) gekippt.
 */
export const USE_MOCKS = {
  auth: true, // M2 Slice 2 kippt auf false
  profile: true, // M2 Slice 3 kippt auf false
  meetups: true, // M3
  groups: true, // M4
  chat: true, // M5
  notifications: true, // M5
} as const

/** True, solange irgendeine Domäne noch Mock-Daten liefert → steuert die „Mock-Daten"-Pille im Header. */
export const ANY_MOCK = Object.values(USE_MOCKS).some(Boolean)

/** Künstliche Mock-Latenz (ms), um Lade-/Skeleton-Zustände erlebbar zu machen. */
export const MOCK_LATENCY = 250
