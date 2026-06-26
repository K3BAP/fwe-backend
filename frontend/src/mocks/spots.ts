import type { Spot } from '@/api/schemas'

/**
 * Kuratierte reale Startplätze im DACH-Raum (SEED_DATA.md §1). Quelle für die Karte und den
 * Spot-Autocomplete im Erstellen-Wizard. Koordinaten sind Näherungswerte für den Startbereich.
 */
const spots: Spot[] = [
  { id: 1, name: 'Wasserkuppe', region: 'Rhön', lat: 50.498, lng: 9.948 },
  { id: 2, name: 'Tegelberg', region: 'Allgäu', lat: 47.585, lng: 10.764 },
  { id: 3, name: 'Brauneck', region: 'Bayerische Voralpen', lat: 47.667, lng: 11.555 },
  { id: 4, name: 'Hochfelln', region: 'Chiemgau', lat: 47.768, lng: 12.61 },
  { id: 5, name: 'Hochries', region: 'Chiemgau', lat: 47.733, lng: 12.23 },
  { id: 6, name: 'Blomberg', region: 'Bayerische Voralpen', lat: 47.683, lng: 11.45 },
  { id: 7, name: 'Jochberg (Walchensee)', region: 'Bayerische Voralpen', lat: 47.6, lng: 11.33 },
  { id: 8, name: 'Wallberg (Tegernsee)', region: 'Tegernsee', lat: 47.66, lng: 11.77 },
  { id: 9, name: 'Hohe Bracht', region: 'Sauerland', lat: 51.13, lng: 7.97 },
  { id: 10, name: 'Greifenburg / Emberger Alm', region: 'Kärnten (Drautal)', lat: 46.76, lng: 13.15 },
  { id: 11, name: 'Sattnitz / Kraig', region: 'Kärnten', lat: 46.72, lng: 14.34 },
  { id: 12, name: 'Stubaital (Elfer / Kreuzjoch)', region: 'Tirol (Stubai)', lat: 47.11, lng: 11.31 },
  { id: 13, name: 'Kössen (Unterberghorn)', region: 'Tirol (Kaisergebirge)', lat: 47.68, lng: 12.4 },
  { id: 14, name: 'Zell am See (Schmittenhöhe)', region: 'Salzburg (Pinzgau)', lat: 47.33, lng: 12.74 },
  { id: 15, name: 'Gerlitzen', region: 'Kärnten', lat: 46.69, lng: 13.91 },
  { id: 16, name: 'Stoderzinken', region: 'Steiermark (Ennstal)', lat: 47.53, lng: 13.89 },
  { id: 17, name: 'Achensee (Maurach / Rofan)', region: 'Tirol', lat: 47.43, lng: 11.73 },
  { id: 18, name: 'Niederöblarn / Wörschachwald', region: 'Steiermark (Ennstal)', lat: 47.5, lng: 14.03 },
  { id: 19, name: 'Interlaken (Beatenberg / Niederhorn)', region: 'Berner Oberland', lat: 46.7, lng: 7.8 },
  { id: 20, name: 'Fiesch / Eggishorn', region: 'Wallis', lat: 46.4, lng: 8.13 },
  { id: 21, name: 'Verbier (La Chaux)', region: 'Wallis', lat: 46.09, lng: 7.25 },
  { id: 22, name: 'Grindelwald (First)', region: 'Berner Oberland', lat: 46.66, lng: 8.06 },
  { id: 23, name: 'Klewenalp (Vierwaldstättersee)', region: 'Zentralschweiz', lat: 46.95, lng: 8.49 },
  { id: 24, name: 'Beuren (Schwäbische Alb)', region: 'Schwäbische Alb', lat: 48.56, lng: 9.39 },
  { id: 25, name: 'Hohenneuffen', region: 'Schwäbische Alb', lat: 48.555, lng: 9.38 },
  { id: 26, name: 'Kandel (Schwarzwald)', region: 'Schwarzwald', lat: 48.06, lng: 8.01 },
  { id: 27, name: 'Hocheck / Oberaudorf', region: 'Inntal (Bayern)', lat: 47.64, lng: 12.18 },
  { id: 28, name: 'Calmont / Bremm', region: 'Mosel/Eifel', lat: 50.09, lng: 7.13 },
  { id: 29, name: 'Nürburg / Hohe Acht', region: 'Mosel/Eifel', lat: 50.38, lng: 7.0 },
  { id: 30, name: 'Idarkopf', region: 'Hunsrück', lat: 49.8, lng: 7.25 },
]

const byId = new Map(spots.map((s) => [s.id, s]))

export const spotsTable = {
  list: (): Spot[] => spots.map((s) => ({ ...s })),
  byId: (id: number): Spot | undefined => {
    const s = byId.get(id)
    return s ? { ...s } : undefined
  },
  /** Tippsuche über Name + Region für den Autocomplete (max. `limit` Treffer). */
  search: (query: string, limit = 6): Spot[] => {
    const q = query.trim().toLowerCase()
    if (!q) return spots.slice(0, limit).map((s) => ({ ...s }))
    return spots
      .filter((s) => s.name.toLowerCase().includes(q) || s.region.toLowerCase().includes(q))
      .slice(0, limit)
      .map((s) => ({ ...s }))
  },
}
