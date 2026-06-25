import type { GroupListItem } from '@/api/schemas'

/**
 * Veränderlicher In-Memory-Datensatz der Gruppen (M1-Mock). In Slice 1 nur die Listen-Projektion
 * (Dashboard + Verzeichnis); Detail/Feed/Mitglieder erweitern diesen Store in Slice 3.
 */
const groups: GroupListItem[] = [
  {
    id: 1,
    slug: 'allgaeu-thermikjaeger',
    name: 'Allgäu Thermikjäger',
    description: 'Streckenflug & Thermik rund um Tegelberg, Nebelhorn und Buchenberg.',
    logo_path: null,
    region: 'Allgäu',
    tags: ['Streckenflug', 'Thermik'],
    visibility: 'public',
    join_policy: 'open',
    members_count: 248,
  },
  {
    id: 2,
    slug: 'rhoen-gleitschirm',
    name: 'Gleitschirmclub Rhön',
    description: 'Die Community an der Wasserkuppe — vom Anfängerhang bis zum Soaring.',
    logo_path: null,
    region: 'Rhön',
    tags: ['Verein', 'Soaring'],
    visibility: 'public',
    join_policy: 'request',
    members_count: 132,
  },
  {
    id: 3,
    slug: 'hike-and-fly-tirol',
    name: 'Hike & Fly Tirol',
    description: 'Aufsteigen, abheben, genießen. Touren im Stubai- und Zillertal.',
    logo_path: null,
    region: 'Tirol',
    tags: ['Hike & Fly', 'Alpin'],
    visibility: 'public',
    join_policy: 'open',
    members_count: 89,
  },
  {
    id: 4,
    slug: 'mosel-soaring',
    name: 'Mosel Soaring Crew',
    description: 'Dynamische Hangflüge am Calmont und entlang der Mosel.',
    logo_path: null,
    region: 'Mosel',
    tags: ['Soaring'],
    visibility: 'unlisted',
    join_policy: 'request',
    members_count: 41,
  },
  {
    id: 5,
    slug: 'eifel-anfaenger',
    name: 'Eifel Einsteiger',
    description: 'Geschützter Raum für frische A-Scheine und Übungshang-Sessions.',
    logo_path: null,
    region: 'Eifel',
    tags: ['Anfänger', 'Übungshang'],
    visibility: 'private',
    join_policy: 'invite_only',
    members_count: 27,
  },
]

/** Lese-/Mutations-Zugriff auf den Mock-Datensatz (in M4 ersetzt durch echte Endpunkte). */
export const groupsTable = {
  list: (): GroupListItem[] => groups.map((g) => ({ ...g })),
}
