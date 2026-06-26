# FlightMeet – REST-API-Referenz (`/api/v1`)

Vollständige Endpunkt-Referenz aller Domänen. Konsolidiert aus den fünf Domänen-Dossiers gegen die ADRs ([`DECISIONS.md`](DECISIONS.md)) und das [`DATA_MODEL.md`](DATA_MODEL.md). Bei Widersprüchen gewinnen ADR + Datenmodell; Auflösungen sind am Ende unter [§13 Audit-Trail](#13-audit-trail-aufgelöste-widersprüche) dokumentiert.

---

## 1. Grundlagen & Konventionen

### 1.1 Base-Path & Versionierung
Alle Endpunkte liegen unter dem Präfix **`/api/v1`** (ADR via offene Frage „API-Versionierung", `/api/v1` bestätigt). Im Folgenden werden Pfade ohne den Präfix notiert, wenn der Kontext eindeutig ist; der vollständige Pfad ist stets `/api/v1{path}`. Same-origin-Auslieferung (SPA aus `public/`), daher **kein CORS**.

### 1.2 Authentifizierung (ADR-004)
- **Mechanismus:** CodeIgniter **Shield**, **Session-Authenticator** mit **HttpOnly-Cookie** (`SameSite=Lax`). **Kein** Bearer-Token, **kein** JWT. Der API-Client sendet Cookies via `credentials: 'include'`.
- **CSRF:** Alle zustandsändernden Requests (`POST/PATCH/PUT/DELETE`) erfordern den CI4-CSRF-Header (`X-CSRF-TOKEN`, Double-Submit). Fehlt/ungültig → `403 csrf_invalid`.
- **Auth-Filter:** Ein `session`-Before-Filter schützt die gesamte `/api/v1`-Gruppe **außer** `auth/register`, `auth/login` und explizit als `public` markierten GET-Endpunkten.
- **Plattform-Rollen:** Shield-Groups `user` (Default) und `admin`.
- **Autorisierung pro Objekt (BOLA-Schutz, ADR-004/Gruppen-Empfehlung):** zusätzlich zum Auth-Filter prüft **jeder** Endpunkt serverseitig Eigentum/Mitgliedschaft gegen `*_members` / `*_participants` / `creator_user_id`. Die Spalte „Auth" unten nennt die jeweils geforderte Berechtigung.

### 1.3 Response-Envelope (offene Frage „Envelope" → Schlankes Envelope)
**Erfolg:**
```json
{ "data": { ... }, "meta": { "page": 1, "perPage": 20, "total": 137 } }
```
`meta` ist optional und nur bei Listen/Pagination gesetzt.

**Fehler:**
```json
{ "error": { "code": "validation_error", "message": "Bitte prüfe deine Eingaben.", "fields": { "title": "Pflichtfeld." } } }
```
- `code`: stabiler, **englischer**, maschinenlesbarer Schlüssel (Frontend mappt darauf).
- `message`: anzeigbarer **deutscher** Text (Fallback fürs Frontend).
- `fields`: optionale Map Feld→deutsche Meldung (nur bei `validation_error`).

### 1.4 Statuscode-Konvention
| Code | Bedeutung |
|---|---|
| 200 | OK (GET/PATCH/idempotenter POST) |
| 201 | Created |
| 204 | No Content (DELETE/erfolgreiche Mutation ohne Body) |
| 304 | Not Modified (ETag/`If-None-Match` bei Polling) |
| 400 | Malformed Request (kaputtes JSON, fehlender Parameter) |
| 401 | `unauthenticated` (kein/abgelaufenes Session-Cookie) |
| 403 | `forbidden` / `csrf_invalid` (eingeloggt, aber nicht berechtigt) |
| 404 | `not_found` (auch absichtlich für nicht-sichtbare private Objekte, statt 403, um Existenz nicht zu leaken) |
| 409 | `conflict` (z.B. doppelter Beitritt, Treffen voll) |
| 422 | `validation_error` (Body-Validierung; `error.fields` gefüllt) |
| 429 | `rate_limited` (Throttle, v.a. Login) |

### 1.5 Validierung (doppelt: Zod + CI4)
Jedes Request-Schema wird **client-seitig mit Zod** (React Hook Form) **und** identisch **server-seitig mit CI4-Validation** geprüft (Defense in Depth). Unten ist je Feld die maßgebliche Regel angegeben; sie gilt für beide Seiten.

### 1.6 Sprach- & Namens-Konvention
Nutzersichtbare Labels Deutsch; **DB-Spalten / API-Felder / Enum-Keys / `error.code` Englisch**. Datum/Zeit als ISO-8601-`DATETIME` in der API (Frontend formatiert de-DE via `Intl`).

### 1.7 Realtime via Polling (ADR-001)
**Kein** WebSocket/SSE, **kein** externer Realtime-Dienst, **kein** `/realtime/auth`-Endpunkt. Live-Aktualisierung = TanStack-Query-Polling gegen dieselben REST-Endpunkte. Polling-Endpunkte unterstützen inkrementelle Abfragen (`?since_id=` / `?before_id=`) und `ETag`/`If-None-Match` → `304`.

### 1.8 Soft-Delete & abgeleitete Felder
Moderierbare Inhalte werden soft-gelöscht (`deleted_at`, ggf. `deleted_by`) und als Tombstone gerendert. Abgeleitete Zustände (z.B. Meetup `full`/`finished`, `participant_count`, `unread_count`) werden **im Read-Pfad berechnet** (kein Cron, ADR-002), nicht persistiert.

### 1.9 Enum-Referenz (konsolidiert, verbindlich)
| Feld | Werte |
|---|---|
| `users`-Rolle (Shield-Group) | `user`, `admin` |
| `users.status` | `active`, `suspended`, `deleted` |
| `profiles.experience_level` | `beginner`, `advanced`, `expert` |
| `meetups.experience_level` | `beginner`, `advanced`, `expert`, `all` |
| `meetups.status` (persistiert) | `open`, `cancelled` |
| `meetups.status` (berechnet, nur im Read) | `open`, `full`, `finished`, `cancelled` |
| `meetup_participants.status` | `confirmed` (Default), `waitlist` (deferred) |
| `groups.visibility` | `public`, `private`, `unlisted` |
| `groups.join_policy` | `open`, `request`, `invite_only` |
| `group_members.role` | `owner`, `admin`, `member` |
| `group_members.status` | `active`, `banned` |
| `group_join_requests.status` | `pending`, `approved`, `rejected`, `cancelled` |
| `group_invites.status` | `pending`, `accepted`, `declined`, `revoked`, `expired` |
| `conversations.type` | `group_channel`, `meetup`, `direct` (`group_feed` deferred) |
| `conversation_participants.role` | `owner`, `admin`, `member` |
| `notifications.type` | MVP-Satz, siehe [§11](#11-notifications) (ADR-012/C8) |

---

## 2. Auth

| # | Methode | Pfad | Auth |
|---|---|---|---|
| 2.1 | POST | `/auth/register` | öffentlich |
| 2.2 | POST | `/auth/login` | öffentlich (throttled) |
| 2.3 | POST | `/auth/logout` | eingeloggt |
| 2.4 | GET | `/auth/me` | eingeloggt |
| 2.5 | GET | `/auth/csrf` | öffentlich |

> E-Mail-Verifikation & Passwort-Reset (`auth/password/forgot|reset`, `auth/verify-email`) sind **deferred** (ADR-008, keine SMTP). Schema vorbereitet, Endpunkte **nicht** im MVP.

### 2.1 POST `/auth/register`
Legt Shield-`users`-Eintrag (Group `user`) + zugehöriges leeres `profiles` an, startet die Session (setzt HttpOnly-Cookie).

**Request**
| Feld | Typ | Regel |
|---|---|---|
| `email` | string | `z.string().email()`, UNIQUE |
| `password` | string | `min(8)` (Shield-Policy), nicht im Response |
| `display_name` | string | `min(2).max(80)`, Pflicht (ADR-010: minimales Pflichtfeld) |
| `handle` | string | **Pflicht**, `^[a-z0-9_]{3,30}$`, UNIQUE (Nutzer werden darüber gefunden) |

**Response 201** → `{ data: { user: PublicUser, profile: OwnProfile } }` (Session via Cookie aktiv).

**Fehler:** `422 validation_error` (`email`/`password`/`display_name`/`handle`); `409 email_taken`; `409 handle_taken`.

### 2.2 POST `/auth/login`
Validiert Credentials über Shield, startet Session-Cookie. **Throttle** gegen Brute-Force.

**Request:** `{ email: string.email(), password: string }`
**Response 200** → `{ data: { user: PublicUser, profile: OwnProfile } }`
**Fehler:** `422 validation_error`; `401 invalid_credentials`; `403 account_suspended` (status≠active); `429 rate_limited`.

### 2.3 POST `/auth/logout`
Beendet die Shield-Session (invalidiert Cookie). **Response 204.**

### 2.4 GET `/auth/me`
Auth-Bootstrapping der SPA (Routing-Gate). **Response 200** → `{ data: { user: PublicUser, profile: OwnProfile, unread: { messages: 12, notifications: 3 } } }`. **Fehler:** `401 unauthenticated`.

### 2.5 GET `/auth/csrf`
Liefert/aktualisiert das CSRF-Token (für SPA-Bootstrapping). **Response 200** → `{ data: { token: string } }` (zusätzlich als Cookie gesetzt).

---

## 3. Profile

| # | Methode | Pfad | Auth |
|---|---|---|---|
| 3.1 | GET | `/users/{userId}` | öffentlich (reduziert) |
| 3.2 | GET | `/me/profile` | eingeloggt (self) |
| 3.3 | PATCH | `/me/profile` | eingeloggt (self) |
| 3.4 | POST | `/me/avatar` | eingeloggt (self) |
| 3.5 | DELETE | `/me/avatar` | eingeloggt (self) |
| 3.6 | GET | `/users` | eingeloggt |
| 3.7 | PATCH | `/admin/users/{userId}` | `admin` |

### 3.1 GET `/users/{userId}`
Öffentliche Profilkarte/-seite eines Nutzers — **ohne Login lesbar** (ADR-012/B1). **Nie `email`**. **Reduzierte Projektion (ADR-012/C2):** Gäste erhalten `display_name`, `handle`, `avatar_url`, `bio_markdown`, `experience_level`; die Zusatzfelder (`home_region`, `glider`, `license_class`, `flight_hours`) nur bei eingeloggter Anfrage.

**Response 200** → `{ data: PublicProfile }`:
```json
{ "data": {
  "user_id": 42, "display_name": "Lena", "handle": "lena_xc",
  "avatar_path": "/media/avatars/ab12.webp",
  "bio_html": "<p>…sanitisiertes Markdown…</p>",
  "experience_level": "advanced", "license_class": "B",
  "glider": "Ozone Rush 6", "home_region": "Mosel",
  "flight_hours": 320, "created_at": "2026-01-04T10:00:00Z"
} }
```
Server rendert Bio-Markdown nicht zwingend serverseitig; bei `bio_html` gilt Tag-Allowlist-Sanitizing, alternativ Rohtext-Feld `bio_markdown` + client-seitiges `react-markdown` ohne `rehype-raw` (ADR-011). **Fehler:** `404 not_found`.

### 3.2 GET `/me/profile`
Eigenes vollständiges, editierbares Profil. **Response 200** → `{ data: OwnProfile }` (wie PublicProfile + `email`, alle Felder roh).

### 3.3 PATCH `/me/profile`
Teilupdate des eigenen Profils. Alle Felder optional (ADR-010, alle Zusatzfelder nullable).

**Request**
| Feld | Typ | Regel |
|---|---|---|
| `display_name` | string | `min(2).max(80)` |
| `handle` | string\|null | `^[a-z0-9_]{3,30}$`, UNIQUE |
| `bio_markdown` | string\|null | `max(2000)`, eingeschränktes Markdown (ADR-011) |
| `experience_level` | enum\|null | `beginner\|advanced\|expert` |
| `license_class` | string\|null | `max(20)` |
| `glider` | string\|null | `max(120)` |
| `home_region` | string\|null | `max(80)` |
| `flight_hours` | int\|null | `>=0` |

**Response 200** → `{ data: OwnProfile }`. **Fehler:** `422 validation_error`; `409 handle_taken`.

### 3.4 POST `/me/avatar`
Multipart-Upload. Server validiert MIME (`image/jpeg|png|webp`) und Größe (≤5 MB), normalisiert auf quadratisch (512px + 128px-Thumb), randomisiert Dateinamen, setzt `avatar_path`.

**Request:** `multipart/form-data`, Feld `file`.
**Response 200** → `{ data: { avatar_path } }`.
**Fehler:** `422 validation_error` (`file`); `400 file_too_large`; `415 unsupported_media_type`.

### 3.5 DELETE `/me/avatar`
Entfernt Avatar, Fallback auf Default. **Response 204.**

### 3.6 GET `/users`
Nutzersuche (für Einladungen, DM-Start, Erwähnungen). Konsolidiert `/api/users` + `/api/users/search`.

**Query:** `q` (LIKE über `display_name`/`handle`), `experience_level`, `limit` (≤50, Default 20), `offset`.
**Response 200** → `{ data: PublicUserCard[], meta: { total, limit, offset } }`.

### 3.7 PATCH `/admin/users/{userId}`
Admin-Moderation: Sperren/Entsperren, Rolle ändern. **Auth: `admin`.**

**Request:** `{ status?: 'active'|'suspended'|'deleted', role?: 'user'|'admin' }`
**Response 200** → `{ data: PublicUser }`. **Fehler:** `403 forbidden`; `404 not_found`; `422 validation_error`.

---

## 4. Spots

| # | Methode | Pfad | Auth |
|---|---|---|---|
| 4.1 | GET | `/spots` | öffentlich (cachebar) |
| 4.2 | GET | `/spots/{id}` | öffentlich |

> Kuratierte Tabelle (ADR-007). **✅ Entschieden (ADR-012/A4):** Nur **Admin/Seed** pflegen die Liste — **kein** `POST /spots` im MVP. Seed ~20–30 Startplätze. `/regions` ist deferred (Region wird aus `spot.region` abgeleitet, ADR-007).

### 4.1 GET `/spots`
Liste/Autocomplete-Quelle. Liefert `lat`/`lng`/`region` für Treffen-Erstellung & Leaflet-Marker. FileCache + ETag (kurze TTL).

**Query:** `q` (Name-Prefix/LIKE), `region`, `type` (`startplatz|landeplatz|gebiet`), `limit`, `offset`.
**Response 200** → `{ data: Spot[] }`:
```json
{ "data": [ { "id": 7, "name": "Wasserkuppe", "region": "Rhön", "country": "DE",
  "lat": 50.4986, "lng": 9.9436, "type": "startplatz" } ] }
```

### 4.2 GET `/spots/{id}`
Einzelner Spot inkl. `description`. **Response 200** → `{ data: Spot }`. **Fehler:** `404 not_found`.

---

## 5. Flugtreffen (Meetups)

| # | Methode | Pfad | Auth |
|---|---|---|---|
| 5.1 | GET | `/meetups` | öffentlich (public-Treffen) / eingeloggt (group-scoped) |
| 5.2 | GET | `/meetups/{id}` | öffentlich/Sichtbarkeit |
| 5.3 | POST | `/meetups` | eingeloggt |
| 5.4 | PATCH | `/meetups/{id}` | Creator oder `admin` |
| 5.5 | DELETE | `/meetups/{id}` | Creator oder `admin` |
| 5.6 | POST | `/meetups/{id}/participants` | eingeloggt |
| 5.7 | DELETE | `/meetups/{id}/participants/me` | Teilnehmer (self) |
| 5.8 | DELETE | `/meetups/{id}/participants/{userId}` | Creator oder `admin` |

> **Status-Konsolidierung:** persistiert nur `open|cancelled`; `full` (= `participant_count >= max_participants`) und `finished` (= `starts_at < NOW()`) werden im Read berechnet (ADR-002). „Teilnehmen/Absagen" ist ein eigener Sub-Resource (`participants`), **nicht** `/join` — vereinheitlicht gegen das Beitrittsmuster der Gruppen.

### 5.1 GET `/meetups`
Bedient Karte, Tabelle und Cards mit einer Route.

**Query**
| Param | Bedeutung |
|---|---|
| `q` | LIKE über `title`/`spot_name`/`region`/`description` |
| `region` | exakt |
| `level` | `beginner\|advanced\|expert\|all` |
| `status` | `open\|full\|finished\|cancelled` (Filter auf berechnetem Status) |
| `date_from`, `date_to` | ISO-Datum, Range auf `starts_at` |
| `has_free_spots` | bool |
| `sort` | `starts_at` (Default), `-starts_at`, `participant_count` |
| `limit`, `offset` | Pagination (Default 20) |

**Response 200** → `{ data: MeetupListItem[], meta: { total, limit, offset } }`:
```json
{ "data": [ {
  "id": 12, "title": "Mosel-Soaring Sonntag", "spot_id": 7, "spot_name": "Wasserkuppe",
  "region": "Rhön", "lat": 50.4986, "lng": 9.9436,
  "starts_at": "2026-07-05T09:00:00Z", "experience_level": "all",
  "max_participants": 15, "participant_count": 8, "free_spots": 7,
  "status": "open", "creator_user_id": 42
} ] }
```

### 5.2 GET `/meetups/{id}`
Detail inkl. Teilnehmerliste, berechnetem Status, `is_participant`-Flag für `current_user`.

**Response 200** → `{ data: MeetupDetail }` (MeetupListItem + `description`, `participants: PublicUserCard[]`, `is_participant: bool`, `can_edit: bool`). **Fehler:** `404 not_found` (auch bei nicht-sichtbarem group-scoped Treffen).

### 5.3 POST `/meetups`
Erstellt Treffen; trägt Creator automatisch als Teilnehmer ein.

**Request**
| Feld | Typ | Regel |
|---|---|---|
| `title` | string | `min(3).max(150)` |
| `description` | string\|null | `max(5000)` |
| `spot_id` | int | existierender Spot; liefert `lat`/`lng`/`region` (ADR-007) |
| `starts_at` | datetime | ISO, **`> now()`** |
| `experience_level` | enum | `beginner\|advanced\|expert\|all` |
| `max_participants` | int | `>=1` |
| `group_id` | int\|null | optional group-scoped (Schema vorbereitet; UI deferred) |

**Response 201** → `{ data: MeetupDetail }`. **Fehler:** `422 validation_error` (`starts_at` in Vergangenheit → `fields.starts_at`; `max_participants < 1`); `404 spot_not_found`.

### 5.4 PATCH `/meetups/{id}`
Bearbeiten **oder Absagen** (`status: 'cancelled'`, soft, behält Historie). **Auth: Creator oder `admin`.** Felder wie 5.3 (alle optional). **Fehler:** `403 forbidden`; `404 not_found`; `422 validation_error`.

### 5.5 DELETE `/meetups/{id}`
Hartes Löschen (kaskadiert `meetup_participants` + zugehörige `conversations` bewusst aufräumen, ADR-005). **Auth: Creator oder `admin`.** Bevorzugt jedoch „Absagen" via 5.4. **Response 204.** **Fehler:** `403 forbidden`; `404 not_found`.

### 5.6 POST `/meetups/{id}/participants`
„Teilnehmen": `current_user` beitreten. Transaktional mit Kapazitätsprüfung (UNIQUE `(meetup_id,user_id)`).

**Request:** leer (oder `{}`).
**Response 201** → `{ data: { participant_count, free_spots, status } }`.
**Fehler:** `409 meetup_full`; `409 already_joined` (alternativ idempotent 200); `409 meetup_cancelled`; `409 meetup_finished`; `404 not_found`.

### 5.7 DELETE `/meetups/{id}/participants/me`
„Absagen": Selbst-Austritt (Button-Toggle). **Response 204** → `{ data: { participant_count, free_spots } }` (200 mit Body möglich). **Fehler:** `404 not_found` (nicht Teilnehmer).

### 5.8 DELETE `/meetups/{id}/participants/{userId}`
Admin/Creator entfernt Teilnehmer. **Auth: Creator oder `admin`.** **Response 204.** **Fehler:** `403 forbidden`.

---

## 6. Gruppen

| # | Methode | Pfad | Auth |
|---|---|---|---|
| 6.1 | GET | `/groups` | öffentlich (public/unlisted-via-Link) |
| 6.2 | GET | `/groups/suggestions` | eingeloggt |
| 6.3 | POST | `/groups` | eingeloggt |
| 6.4 | GET | `/groups/{slug}` | Sichtbarkeit |
| 6.5 | PATCH | `/groups/{id}` | `owner`/`admin` |
| 6.6 | DELETE | `/groups/{id}` | `owner` |
| 6.7 | GET | `/groups/{id}/members` | Policy |
| 6.8 | POST | `/groups/{id}/members` | eingeloggt (join_policy=open) |
| 6.9 | PATCH | `/groups/{id}/members/{userId}` | `owner`/`admin` |
| 6.10 | DELETE | `/groups/{id}/members/{userId}` | self (leave) / `owner`/`admin` (kick) |
| 6.11 | POST | `/groups/{id}/join-requests` | eingeloggt (join_policy=request) |
| 6.12 | GET | `/groups/{id}/join-requests` | `owner`/`admin` |
| 6.13 | PATCH | `/groups/{id}/join-requests/{requestId}` | `owner`/`admin` |
| 6.14 | POST | `/groups/{id}/invites` | `owner`/`admin` |
| 6.15 | GET | `/groups/{id}/invites` | `owner`/`admin` |
| 6.16 | DELETE | `/groups/{id}/invites/{inviteId}` | `owner`/`admin` |
| 6.17 | GET | `/invites/{token}` | öffentlich (Preview) |
| 6.18 | POST | `/invites/{token}/accept` | eingeloggt |

> **Zwei orthogonale Achsen** (ADR-006): `visibility` ∈ `public|private|unlisted`, `join_policy` ∈ `open|request|invite_only`. Default neuer Gruppen: `public` + `open`. Beitritt/Einladung sind **getrennte** Tabellen (`group_join_requests` vs. `group_invites`), nicht eine `join_requests`-Tabelle.

### 6.1 GET `/groups`
Verzeichnis. Listet `public` + via-Link `unlisted`; **nie** `private`. Suche/Filter.

**Query:** `q` (LIKE Name/Beschreibung), `region`, `tag`, `limit`, `offset`.
**Response 200** → `{ data: GroupListItem[], meta }`:
```json
{ "data": [ { "id": 3, "slug": "flieger-trier", "name": "Flieger Trier",
  "description": "…", "logo_path": null, "region": "Trier",
  "tags": ["xc","anfaengerfreundlich"], "visibility": "public",
  "join_policy": "open", "members_count": 24 } ] }
```

### 6.2 GET `/groups/suggestions`
Dashboard-Heuristik: Region-Match + Popularität, ohne bereits beigetretene Gruppen. **Response 200** → `{ data: GroupListItem[] }`.

### 6.3 POST `/groups`
Gründet Gruppe; Ersteller wird `owner`; legt automatisch Default-`conversations`-Channel „Allgemein" (`type='group_channel'`, `is_default`) an (ADR-005, Default-Channel-Regel).

**Request**
| Feld | Typ | Regel |
|---|---|---|
| `name` | string | `min(3).max(100)`, UNIQUE |
| `slug` | string\|auto | `^[a-z0-9-]{3,60}$`, UNIQUE (auto aus `name` falls leer) |
| `description` | string\|null | `max(2000)` |
| `region` | string\|null | `max(80)` |
| `tags` | string[]\|null | je `max(30)`, max 8 |
| `rules_text` | string\|null | `max(5000)` |
| `visibility` | enum | `public`(Default)\|`private`\|`unlisted` |
| `join_policy` | enum | `open`(Default)\|`request`\|`invite_only` |

**Response 201** → `{ data: GroupDetail }`. **Fehler:** `422 validation_error`; `409 name_taken`; `409 slug_taken`.

### 6.4 GET `/groups/{slug}`
Detail/Metadaten. Sichtbarkeit je `visibility`+Mitgliedschaft; **Feed immer öffentlich lesbar** bei `visibility != private` (ADR-006). **Response 200** → `{ data: GroupDetail }` (GroupListItem + `rules_text`, `owner_user_id`, `my_membership: { role, status } | null`, `can_manage: bool`). **Fehler:** `404 not_found` (für `private` ohne Mitgliedschaft).

### 6.5 PATCH `/groups/{id}`
Metadaten bearbeiten (Felder wie 6.3, alle optional). **Auth: `owner`/`admin`.** **Fehler:** `403 forbidden`; `409 name_taken`.

### 6.6 DELETE `/groups/{id}`
Soft-Delete (`deleted_at`). **Auth: nur `owner`.** Zugehörige `conversations` (Channels) bewusst aufräumen. **Response 204.** **Fehler:** `403 forbidden`.

### 6.7 GET `/groups/{id}/members`
Mitgliederliste mit Rollen. Sichtbarkeit je Policy. **Query:** `limit`, `offset` (Offset-Pagination genügt). **Response 200** → `{ data: GroupMember[], meta }` (`{ user: PublicUserCard, role, status, joined_at }`).

### 6.8 POST `/groups/{id}/members`
Direkter Beitritt **nur** bei `join_policy=open`. Erzeugt `group_members` (`role=member`, `status=active`).

**Response 201** → `{ data: GroupMember }`.
**Fehler:** `409 already_member`; `403 join_policy_request` (→ stattdessen 6.11); `403 join_policy_invite_only`; `403 banned`.

### 6.9 PATCH `/groups/{id}/members/{userId}`
Moderieren: Rolle ändern (`promote`/`demote`), bannen/entbannen (`status`), **Eigentumsübertragung** (`role=owner` → nur durch aktuellen `owner`). **Auth: `owner`/`admin`.**

**Request:** `{ role?: 'owner'|'admin'|'member', status?: 'active'|'banned' }`
**Response 200** → `{ data: GroupMember }`.
**Fehler:** `403 forbidden`; `403 owner_transfer_requires_owner`; `409 already_in_state`.

### 6.10 DELETE `/groups/{id}/members/{userId}`
Selbst-Austritt (`{userId}=me` oder eigene id) **immer erlaubt außer letzter `owner`**; Kick durch `owner`/`admin`. **Response 204.** **Fehler:** `409 owner_must_transfer_first`; `403 forbidden`.

### 6.11 POST `/groups/{id}/join-requests`
Beitrittsantrag (`join_policy=request`) mit optionaler Begründung.
**Request:** `{ message?: string.max(500) }`
**Response 201** → `{ data: JoinRequest }` (`status=pending`).
**Fehler:** `409 request_pending`; `409 already_member`; `403 wrong_join_policy`.

### 6.12 GET `/groups/{id}/join-requests`
Offene Anträge. **Auth: `owner`/`admin`.** **Query:** `status` (Default `pending`). **Response 200** → `{ data: JoinRequest[] }`.

### 6.13 PATCH `/groups/{id}/join-requests/{requestId}`
Genehmigen/Ablehnen. **Auth: `owner`/`admin`.** Genehmigung erzeugt `group_members`-Eintrag transaktional.
**Request:** `{ decision: 'approved'|'rejected' }`
**Response 200** → `{ data: JoinRequest }` (mit `decided_by`, `decided_at`). **Fehler:** `409 already_decided`; `403 forbidden`.

### 6.14 POST `/groups/{id}/invites`
Einladung: gerichtet an Nutzer **ODER** teilbarer Token-Link. **Auth: `owner`/`admin`.**

**Request**
| Feld | Typ | Regel |
|---|---|---|
| `invited_user_id` | int\|null | gerichtete Einladung (exklusiv zu `token`-Modus) |
| `expires_at` | datetime\|null | nur Token-Link |
| `max_uses` | int\|null | nur Token-Link, `>=1` |

**Response 201** → `{ data: GroupInvite }` (bei Token-Modus inkl. `token`). **Fehler:** `422 validation_error`; `409 already_member`; `409 invite_pending`.

### 6.15 GET `/groups/{id}/invites`
Aktive Einladungen. **Auth: `owner`/`admin`.** **Response 200** → `{ data: GroupInvite[] }`.

### 6.16 DELETE `/groups/{id}/invites/{inviteId}`
Widerrufen (`status=revoked`). **Auth: `owner`/`admin`.** **Response 204.**

### 6.17 GET `/invites/{token}`
Öffentliche Preview vor Annahme (Gruppenname/Info). **Response 200** → `{ data: { group: GroupListItem, valid: bool, expired: bool, uses_left: int|null } }`. **Fehler:** `404 invite_not_found`.

### 6.18 POST `/invites/{token}/accept`
Token einlösen → `group_members`-Eintrag, falls gültig/nicht abgelaufen/`uses` verfügbar; inkrementiert `uses_count`. **Auth: eingeloggt.** **Response 201** → `{ data: GroupMember }`. **Fehler:** `409 invite_expired`; `409 invite_exhausted` (max_uses); `409 invite_revoked`; `409 already_member`.

---

## 7. Channels (Gruppen-Channels)

Gruppen-Channels sind **`conversations` mit `type='group_channel'`** (ADR-005, **keine** separate `group_channels`/`group_messages`-Tabelle). Channel-Verwaltung ist Admin-Recht; das Senden/Lesen von Nachrichten läuft über die generische Chat-Engine ([§9](#9-messages-generische-chat-engine)).

| # | Methode | Pfad | Auth |
|---|---|---|---|
| 7.1 | GET | `/groups/{id}/channels` | Mitglied (bzw. Sichtbarkeit) |
| 7.2 | POST | `/groups/{id}/channels` | `owner`/`admin` |
| 7.3 | PATCH | `/groups/{id}/channels/{channelId}` | `owner`/`admin` |
| 7.4 | DELETE | `/groups/{id}/channels/{channelId}` | `owner`/`admin` |

### 7.1 GET `/groups/{id}/channels`
Channels der Gruppe (gefiltert nach Mitgliedschaft; in v1 sehen alle Mitglieder alle Channels). **Response 200** → `{ data: Channel[] }`:
```json
{ "data": [ { "conversation_id": 88, "name": "Allgemein", "description": null,
  "position": 0, "is_default": true, "unread_count": 4 } ] }
```
**Fehler:** `403 not_a_member` / `404 not_found`.

### 7.2 POST `/groups/{id}/channels`
Legt `conversations`-Channel an (alle Gruppenmitglieder werden Teilnehmer bzw. Mitgliedschaft wird über `group_members` abgeleitet). **Auth: `owner`/`admin`.**
**Request:** `{ name: string.min(1).max(80), description?: string.max(300), position?: int }`
**Response 201** → `{ data: Channel }`. **Fehler:** `403 forbidden`; `422 validation_error`.

### 7.3 PATCH `/groups/{id}/channels/{channelId}`
Umbenennen/umordnen. **Auth: `owner`/`admin`.** **Response 200** → `{ data: Channel }`.

### 7.4 DELETE `/groups/{id}/channels/{channelId}`
Löschen — **nicht** den Default/letzten Channel. **Auth: `owner`/`admin`.** **Response 204.** **Fehler:** `409 cannot_delete_default_channel`; `409 cannot_delete_last_channel`; `403 forbidden`.

---

## 8. Feed (Gruppen-Feed)

Read-only Admin-Broadcast (ADR-006/Gruppen-Empfehlung), **öffentlich lesbar** auch für Nicht-Mitglieder, sofern `group.visibility != private`. Keine Kommentare/Reaktionen im MVP. Eigene Tabelle `feed_posts` (kein `conversations`-Typ; `group_feed` deferred, ADR-Chat).

| # | Methode | Pfad | Auth |
|---|---|---|---|
| 8.1 | GET | `/groups/{id}/feed` | öffentlich (sofern visibility≠private) |
| 8.2 | POST | `/groups/{id}/feed` | `owner`/`admin` |
| 8.3 | PATCH | `/groups/{id}/feed/{postId}` | `owner`/`admin` |
| 8.4 | DELETE | `/groups/{id}/feed/{postId}` | `owner`/`admin` |

### 8.1 GET `/groups/{id}/feed`
Keyset-Pagination (`?before_id=`, `limit`). **Response 200** → `{ data: FeedPost[], meta: { next_cursor } }`:
```json
{ "data": [ { "id": 51, "group_id": 3, "author": { "user_id": 42, "display_name": "Lena" },
  "title": "Saisonstart", "body": "…", "image_path": null, "is_pinned": true,
  "created_at": "2026-06-01T08:00:00Z", "updated_at": null } ] }
```

### 8.2 POST `/groups/{id}/feed`
**Auth: `owner`/`admin`.** **Request:** `{ title?: string.max(150), body: string.min(1).max(10000), image_path?: string, is_pinned?: bool }`. **Response 201** → `{ data: FeedPost }`. **Fehler:** `403 forbidden`; `422 validation_error`.

### 8.3 PATCH `/groups/{id}/feed/{postId}`
Bearbeiten/Anpinnen. **Auth: `owner`/`admin`.** **Response 200** → `{ data: FeedPost }`.

### 8.4 DELETE `/groups/{id}/feed/{postId}`
Soft-Delete (`deleted_at`, `deleted_by`). **Auth: `owner`/`admin`.** **Response 204.**

---

## 9. Chat – Conversations

Generische polymorphe Engine (ADR-005): `conversations(type, context_type, context_id)` + `conversation_participants` + `messages` für **alle** Chat-Orte. `type` ∈ `group_channel|meetup|direct`. Autorisierung **immer** gegen `conversation_participants` (BOLA).

| # | Methode | Pfad | Auth |
|---|---|---|---|
| 9.1 | GET | `/conversations` | eingeloggt |
| 9.2 | POST | `/conversations` | eingeloggt |
| 9.3 | GET | `/conversations/{id}` | Teilnehmer |
| 9.4 | POST | `/conversations/{id}/read` | Teilnehmer |

### 9.1 GET `/conversations`
Konversationen des Nutzers mit letzter Nachricht + Ungelesen-Zähler. Polling-fähig (`ETag`).
**Query:** `type?` (Filter), `limit`, `offset` (sortiert nach `last_message_at`).
**Response 200** → `{ data: ConversationListItem[] }`:
```json
{ "data": [ { "id": 88, "type": "direct", "title": "Tom", "context_type": null,
  "context_id": null, "last_message": { "id": 9001, "body": "bis morgen!",
  "sender_id": 7, "created_at": "2026-06-18T20:00:00Z" },
  "unread_count": 2, "last_message_at": "2026-06-18T20:00:00Z" } ] }
```

### 9.2 POST `/conversations`
**Find-or-create** für `type=direct` (deterministischer `dm_key = minId_maxId`, transaktional, ADR-005). Für `group_channel`/`meetup` werden Konversationen über die jeweilige Domäne erzeugt (Channel-Anlage §7.2, Meetup-Chat automatisch) — dieser Endpunkt dient primär DMs.

**Request:** `{ type: 'direct', target_user_id: int }`
**Response 200** (existierte) **/ 201** (neu) → `{ data: ConversationDetail }`.
**Fehler:** `422 validation_error`; `404 user_not_found`; `409 cannot_dm_self`.

### 9.3 GET `/conversations/{id}`
Metadaten + Teilnehmer (nach Mitgliedschaftsprüfung). **Response 200** → `{ data: ConversationDetail }` (`{ id, type, title, context_type, context_id, participants: PublicUserCard[], my_role, creator_user_id }`; `creator_user_id` für Ersteller-Hervorhebung bei `type=meetup`). **Fehler:** `403 not_a_participant` / `404 not_found`.

### 9.4 POST `/conversations/{id}/read`
Setzt `last_read_message_id` (Ungelesen-Zähler, ADR-005). **Request:** `{ last_read_message_id: int }`. **Response 204.** **Fehler:** `403 not_a_participant`.

---

## 10. Messages

Senden, Verlauf (Keyset), Soft-Edit/Delete, Reaktionen (ADR-009: Chat-MVP „Mittel"). Nachrichten sind **Plaintext + Auto-Linkify** (ADR-011, kein Markdown/HTML). Persistenz immer in MySQL (Source of Truth); Live via Polling (`?since_id=`).

| # | Methode | Pfad | Auth |
|---|---|---|---|
| 10.1 | GET | `/conversations/{id}/messages` | Teilnehmer |
| 10.2 | POST | `/conversations/{id}/messages` | Teilnehmer (Schreibrecht) |
| 10.3 | PATCH | `/messages/{id}` | nur Sender |
| 10.4 | DELETE | `/messages/{id}` | Sender oder Conversation-`owner`/`admin` |
| 10.5 | PUT | `/messages/{id}/reactions/{emoji}` | Teilnehmer |
| 10.6 | DELETE | `/messages/{id}/reactions/{emoji}` | Teilnehmer (self) |

> Konsolidiert die widersprüchlichen Pfade `/api/channels/{channelId}/messages` (Gruppen-Dossier) und `/api/conversations/{id}/messages` (Chat-Dossier) auf **`/conversations/{id}/messages`**, da Channel = Conversation (ADR-005). `id` ist die `conversation_id`.

### 10.1 GET `/conversations/{id}/messages`
Keyset-/Cursor-Pagination. Polling-Endpunkt.
**Query:** `before_id` (ältere History), `since_id` (neue Nachrichten beim Polling), `limit` (≤100, Default 30). Unterstützt `If-None-Match` → `304`.
**Response 200** → `{ data: Message[], meta: { next_cursor } }`:
```json
{ "data": [ { "id": 9001, "conversation_id": 88, "sender": { "user_id": 7, "display_name": "Tom" },
  "body": "bis morgen!", "reply_to_id": null, "is_creator": false,
  "created_at": "2026-06-18T20:00:00Z", "edited_at": null, "deleted_at": null,
  "reactions": [ { "emoji": "👍", "count": 2, "me": true } ] } ] }
```
Gelöschte Nachrichten als Tombstone (`deleted_at` gesetzt, `body: null`). `is_creator` = abgeleitetes Flag (`sender_id == context.creator_id` bei `type=meetup`, ADR-005). **Fehler:** `403 not_a_participant`.

### 10.2 POST `/conversations/{id}/messages`
**Request:** `{ body: string.min(1).max(4000), reply_to_id?: int }`
**Response 201** → `{ data: Message }`.
**Fehler:** `422 validation_error`; `403 not_a_participant`; `403 insufficient_role` (z.B. read-only); `409 reply_target_not_found`.

### 10.3 PATCH `/messages/{id}`
Soft-Edit (`edited_at`). **Auth: nur eigener Sender.** **Request:** `{ body: string.min(1).max(4000) }`. **Response 200** → `{ data: Message }`. **Fehler:** `403 forbidden`; `409 message_deleted`.

### 10.4 DELETE `/messages/{id}`
Soft-Delete (`deleted_at`; bei Moderation `deleted_by`). **Auth: Sender oder Conversation-`owner`/`admin`.** **Response 204.** **Fehler:** `403 forbidden`; `404 not_found`.

### 10.5 PUT `/messages/{id}/reactions/{emoji}`
Reaktion setzen (idempotent; UNIQUE `(message_id,user_id,emoji)`). `emoji` URL-encoded Unicode. **Response 200** → `{ data: { emoji, count, me: true } }`. **Fehler:** `403 not_a_participant`; `422 invalid_emoji`.

### 10.6 DELETE `/messages/{id}/reactions/{emoji}`
Eigene Reaktion entfernen. **Response 204.**

> Konsolidiert den toggelnden `POST /messages/{id}/reactions` (Chat-Dossier) zu **idempotentem PUT/DELETE** je Emoji (REST-sauber, race-frei).

---

## 11. Notifications

In-App-Benachrichtigungen (ADR-008, im Scope). Notification-Center + globaler Badge-Zähler; gleicher Polling-Read-Pfad.

| # | Methode | Pfad | Auth |
|---|---|---|---|
| 11.1 | GET | `/notifications` | eingeloggt (self) |
| 11.2 | GET | `/notifications/unread-count` | eingeloggt (self) |
| 11.3 | POST | `/notifications/{id}/read` | self |
| 11.4 | POST | `/notifications/read-all` | self |

### 11.1 GET `/notifications`
**Query:** `unread_only?` (bool), `limit`, `offset`. **Response 200** → `{ data: Notification[], meta }`:
```json
{ "data": [ { "id": 301, "type": "meetup_join", "actor": { "user_id": 7, "display_name": "Tom" },
  "subject_type": "meetup", "subject_id": 12, "data": { "title": "Mosel-Soaring" },
  "read_at": null, "created_at": "2026-06-18T19:00:00Z" } ] }
```

### 11.2 GET `/notifications/unread-count`
Schlanker Zähler-Endpunkt für die Badge (Polling, `ETag`/`304`, ADR-001). **Response 200** → `{ data: { count: 3 } }`.

### 11.3 POST `/notifications/{id}/read`
Einzelne als gelesen markieren (`read_at`). **Response 204.** **Fehler:** `403 forbidden` (fremde Notification); `404 not_found`.

### 11.4 POST `/notifications/read-all`
Alle als gelesen markieren. **Response 204.**

> **✅ Entschieden (ADR-012/C8):** `notifications.type` ist `VARCHAR` (erweiterbar) mit festem MVP-Satz: `meetup_join`, `meetup_cancelled`, `meetup_updated`, `group_join_request`, `group_request_approved`, `group_invite`, `message_received`, `group_feed_post`, `group_role_changed`. Aggregation für `message_received`: **eine** Notification pro Konversation (ADR-012/C7).

---

## 12. Uploads (Querschnitt)

| # | Methode | Pfad | Auth |
|---|---|---|---|
| 12.1 | POST | `/uploads` | eingeloggt |

### 12.1 POST `/uploads`
Generischer Datei-Upload (Gruppen-Logo, Feed-Bild). Validiert MIME (`image/jpeg|png|webp`) + Größe (≤5 MB), randomisiert Dateinamen, schreibt nach `public/media/...` (vom Vite-`emptyOutDir` geschützt, ADR-002), gibt Pfad zurück.

**Request:** `multipart/form-data`, Feld `file`, optional `purpose` (`group_logo|feed_image`).
**Response 201** → `{ data: { path: "/media/uploads/ab12.webp", mime_type, size_bytes } }`.
**Fehler:** `422 validation_error`; `400 file_too_large`; `415 unsupported_media_type`.

> Avatar-Upload hat einen eigenen, dedizierten Endpunkt (§3.4 `POST /me/avatar`) mit Normalisierung. **TODO (ADR-012/D3):** Webspace-Schreibrechte/Quota für `public/media/uploads/` früh auf dem echten Host testen (ADR-002); andernfalls externe URL-Referenzen.

---

## 13. Audit-Trail (aufgelöste Widersprüche)

| # | Quelle(n) | Widerspruch | Auflösung | Begründung |
|---|---|---|---|---|
| 1 | auth-profil, chat | Bearer/JWT-Token; `auth_tokens`-Tabelle; HttpOnly-JWT-Cookie | **Shield Session-Cookie**, kein Bearer/JWT, kein `auth_tokens` | ADR-004 |
| 2 | mehrere | Pfade teils ohne `/v1` (`/api/auth/...`) | Einheitlich **`/api/v1`** | backend-deploy offene Frage |
| 3 | flugtreffen, chat | `/realtime/auth`, Pusher/Supabase-Trigger | **gestrichen**; Polling-only | ADR-001 |
| 4 | flugtreffen | `status` `geplant\|laeuft\|abgesagt\|beendet` | persistiert **`open\|cancelled`**, `full`/`finished` berechnet | ADR-002, DATA_MODEL |
| 5 | flugtreffen vs. backend-deploy | `experience_level` `anfaenger\|fortgeschritten\|profi/experte` | **`beginner\|advanced\|expert`** (+`all` nur Meetup) | DATA_MODEL-Vereinheitlichung |
| 6 | backend-deploy | `POST/DELETE /meetups/{id}/join`; `meetup_participants.status` `zugesagt\|vielleicht\|abgesagt` | **`/meetups/{id}/participants`** Sub-Resource; `confirmed`(+`waitlist` deferred) | konsistent zu Gruppen-Beitritt, DATA_MODEL |
| 7 | gruppen, backend-deploy | `group_channels`+`group_messages`; `/api/channels/{channelId}/messages` | Channel = `conversations type='group_channel'`; Messages über **`/conversations/{id}/messages`** | ADR-005 |
| 8 | backend-deploy | eine `join_requests`-Tabelle (request+invite) | getrennt **`group_join_requests`** + **`group_invites`** | ADR-006 |
| 9 | backend-deploy | `groups.visibility` `public\|private\|invite_only` (vermischt Beitritt) | **`visibility`** ∈ public/private/unlisted **+** separates **`join_policy`** | ADR-006 |
| 10 | chat | `conversation_members` | **`conversation_participants`** | DATA_MODEL |
| 11 | chat, backend-deploy | `message_reads`-Tabelle für Unread | **`last_read_message_id`** je Teilnehmer; `message_reads` entfällt | ADR-005, DATA_MODEL |
| 12 | chat | `POST /messages/{id}/reactions` (toggle) | **`PUT/DELETE /messages/{id}/reactions/{emoji}`** (idempotent) | REST-Sauberkeit; ADR-009 behält Reaktionen im MVP |
| 13 | chat | Reaktionen/Edit/Delete als „Phase 2" | **im MVP** | ADR-009 hebt „Mittel"-Scope an |
| 14 | auth-profil | `auth/password/*`, `auth/verify-email` | **deferred**, nicht im MVP | ADR-008 (keine SMTP) |
| 15 | chat | `conversations.type` enthält `group_feed` | `group_feed` **deferred**; Feed über eigene `feed_posts`-Tabelle | ADR-Chat offene Frage; ADR-006 |
| 16 | auth-profil, backend-deploy | `/api/users/{id}` vs. `/api/v1/profiles/{id}` | **`/users/{userId}`** (Profil, öffentlich/reduziert — ADR-012/B1+C2) + `/users` (Suche, eingeloggt) | Kap. 01 / ADR-012 |

---

### Offene Detail-Punkte (inline markiert, vor Migration zu klären)
- **§4 Spots:** Nutzer-eigene Spots (`POST /spots`) vs. nur Admin-Pflege (ADR-007).
- **§11 Notifications:** finaler `type`-Schlüsselsatz.
- **§12 Uploads:** Webspace-Schreibrechte/Quota für `public/media/uploads/`.
- **Querschnitt (DATA_MODEL):** `users.id`-Typ (Shield `INT UNSIGNED` vs. einheitliches `BIGINT`) betrifft jeden user-FK — blockierend für die Migrationsphase, aber außerhalb der API-Oberfläche.

---

Die Datei `API.md` ist als reiner Markdown-Inhalt oben vollständig konsolidiert. Zentrale Konsolidierungs-Entscheidungen: einheitlicher `/api/v1`-Präfix, **Shield-Session-Cookie statt Bearer/JWT** (ADR-004), **Polling statt Realtime-Dienst** (kein `/realtime/auth`, ADR-001), **eine polymorphe Chat-Engine** (Channel = Conversation, Messages unter `/conversations/{id}/messages`, ADR-005), **getrennte Beitritts-/Einladungs-Pfade** und **`visibility`+`join_policy`** (ADR-006), **berechneter Meetup-Status** `open|cancelled` persistiert (ADR-002), vereinheitlichte Enums (`beginner|advanced|expert`), sowie Reaktionen/Soft-Edit/Delete im MVP (ADR-009). Alle 16 aufgelösten Widersprüche sind im Audit-Trail (§13) dokumentiert; die zuvor offenen Detailpunkte sind durch **ADR-012** entschieden (u.a. `spots` nur Admin, `notifications.type`-Satz, Feed-Reaktionen).
