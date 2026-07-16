import { MOCK_LATENCY } from '@/config'
import { ApiError } from '@/api/http'

/**
 * Gemeinsame Mock-Laufzeit der Daten-Naht (ADR-016). Kapselt künstliche Latenz und ein
 * umschaltbares Szenario, damit jeder Lade-/Empty-/Error-Zustand im Prototyp durchspielbar ist —
 * ohne dass Hooks oder Komponenten davon wissen.
 */

export type MockScenario = 'ok' | 'empty' | 'error'

let scenario: MockScenario = 'ok'
const listeners = new Set<(s: MockScenario) => void>()

export function getScenario(): MockScenario {
  return scenario
}

/** Setzt das globale Mock-Szenario (Dev-Steuerung) und benachrichtigt Abonnenten. */
export function setScenario(next: MockScenario): void {
  scenario = next
  listeners.forEach((l) => l(next))
}

/** Abonniert Szenario-Wechsel (für eine Dev-Steuerung). Gibt eine Unsubscribe-Funktion zurück. */
export function subscribeScenario(listener: (s: MockScenario) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Simuliert einen Read über die Naht: wartet Latenz, erzwingt bei Szenario `error` einen Fehler
 * (wie eine echte API) bzw. bei `empty` den übergebenen Leerwert, sonst das echte Mock-Ergebnis.
 */
export async function mockRead<T>(produce: () => T, opts?: { emptyValue?: T }): Promise<T> {
  await delay(MOCK_LATENCY)
  if (scenario === 'error') {
    throw new ApiError('mock_error', 'Mock: Laden fehlgeschlagen.', 503)
  }
  if (scenario === 'empty' && opts && 'emptyValue' in opts) {
    return opts.emptyValue as T
  }
  return produce()
}

/** Simuliert eine Mutation über die Naht: wartet Latenz, führt dann den Effekt aus. */
export async function mockWrite<T>(effect: () => T): Promise<T> {
  await delay(MOCK_LATENCY)
  return effect()
}
