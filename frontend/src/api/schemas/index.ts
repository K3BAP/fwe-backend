/**
 * Barrel der Zod-DTO-Schemas = Single Source of Truth für die Typen über die API-Grenze
 * (ADR-003, API.md). `z.infer` liefert die TS-Typen; dieselben Schemas validieren echte
 * Responses (api/http). Pro Domäne eine Datei (keine Gottdatei, ADR-013).
 */
export * from './common'
export * from './auth'
export * from './meetups'
export * from './groups'
export * from './chat'
export * from './profiles'
export * from './notifications'
export * from './weather'
export * from './briefing'
export * from './admin'
