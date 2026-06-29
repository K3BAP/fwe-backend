/**
 * Prototyp-zuerst (ADR-016): In M1 läuft die UI gegen **Mock-Daten**; ab M2 wird **pro Domäne** hinter
 * der Daten-Naht (api/*) auf echtes `fetch` umgestellt — die UI-Komponenten bleiben unverändert. Jeder
 * Schalter wird in seinem Milestone von `true` (Mock) auf `false` (echtes Backend) gekippt.
 */
export const USE_MOCKS = {
  auth: false, // M2 Slice 2 — echtes Shield-Backend
  profile: false, // M2 Slice 3 — echtes Profile-Backend
  meetups: false, // M3 — echtes Flugtreffen-/Spots-Backend
  groups: false, // M4 — echtes Gruppen-Backend
  chat: false, // M5 — echtes Chat-Backend
  notifications: false, // M5 — echtes Benachrichtigungs-Backend
} as const

/** True, solange irgendeine Domäne noch Mock-Daten liefert → steuert die „Mock-Daten"-Pille im Header. */
export const ANY_MOCK = Object.values(USE_MOCKS).some(Boolean)

/** Künstliche Mock-Latenz (ms), um Lade-/Skeleton-Zustände erlebbar zu machen. */
export const MOCK_LATENCY = 250

/**
 * Gestaffeltes Polling (ms) für den Live-Chat/Notifications (ADR-001, M5). Aktiver Thread schnell,
 * Listen/Aggregate langsamer; React Query pausiert bei `document.hidden`
 * (`refetchIntervalInBackground` bleibt auf dem Default `false`).
 */
export const POLL = { activeThread: 2500, lists: 20000 } as const
