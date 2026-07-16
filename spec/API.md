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
{ "data": { ... }, "meta": { "total": 137, "limit": 20, "offset": 0, "sort": "starts_at_asc" } }
```
`meta` ist optional und nur bei serverseitig paginierten Listen gesetzt (Flugtreffen §5.1, Admin-Listen §11b) — Shape `{ total, limit, offset, sort }`.

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
| 503 | `weather_unavailable` / `briefing_unavailable` (externer Dienst nicht erreichbar; Wetter-/KI-Proxy, ADR-017/018) |

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
| Konto-Zustand (abgeleitet aus `users.active` + `users.deleted_at`, keine eigene Spalte) | `active`, `suspended`, `deleted` |
| `profiles.experience_level` | `beginner`, `advanced`, `expert` |
| `meetups.experience_level` | `beginner`, `advanced`, `expert`, `all` |
| `meetups.status` (persistiert) | `open`, `cancelled` |
| `meetups.derived_status` (berechnet, nur im Read) | `open`, `full`, `finished`, `cancelled` |
| `groups.visibility` | `public`, `private`, `unlisted` |
| `groups.join_policy` | `open`, `request`, `invite_only` |
| `group_members.role` | `owner`, `admin`, `moderator`, `member` |
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

### 3.1 GET `/users/{userId}`
Öffentliche Profilkarte/-seite eines Nutzers — **ohne Login lesbar** (ADR-012/B1). **Nie `email`**. **Reduzierte Projektion (ADR-012/C2):** Gäste erhalten `display_name`, `handle`, `avatar_url`, `bio_markdown`, `experience_level`; die Zusatzfelder (`home_region`, `glider`, `license_class`, `flight_hours`) nur bei eingeloggter Anfrage.

**Response 200** → `{ data: PublicProfile }`:
```json
{ "data": {
  "user_id": 42, "display_name": "Lena", "handle": "lena_xc",
  "avatar_path": "/media/avatars/ab12.webp",
  "bio_markdown": "Fliegt seit 2019 an der Mosel …",
  "experience_level": "advanced", "license_class": "B",
  "glider": "Ozone Rush 6", "home_region": "Mosel",
  "flight_hours": 320, "created_at": "2026-01-04T10:00:00Z"
} }
```
Die Bio wird als Rohtext-Feld `bio_markdown` ausgeliefert; das Frontend rendert sie client-seitig mit `react-markdown` **ohne** `rehype-raw` (ADR-011 — kein HTML im Payload, kein serverseitiges `bio_html`). **Fehler:** `404 not_found`.

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
| `license_class` | string\|null | `max(60)` |
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

> Admin-Moderation (Profil bearbeiten, Rolle, Sperre, Soft-Delete) liegt unter `/admin/users/*` — siehe [§11b](#11b-admin-adr-019). Ein früher hier skizziertes `PATCH /admin/users/{userId}` mit `{status, role}`-Body ist durch die dortigen, getrennten Endpunkte (11b.4–11b.8) abgelöst.

---

## 4. Spots

| # | Methode | Pfad | Auth |
|---|---|---|---|
| 4.1 | GET | `/spots` | öffentlich (cachebar) |
| 4.2 | GET | `/spots/{id}` | öffentlich |

> Kuratierte Tabelle (ADR-007). **✅ Entschieden (ADR-012/A4):** Nur **Admin/Seed** pflegen die Liste — **kein** `POST /spots` im MVP. Seed ~20–30 Startplätze. `/regions` ist deferred (Region wird aus `spot.region` abgeleitet, ADR-007).

### 4.1 GET `/spots`
Liste/Autocomplete-Quelle. Liefert `lat`/`lng`/`region` für Treffen-Erstellung & Leaflet-Marker. FileCache + ETag (kurze TTL).

**Query:** `q` (Name-Prefix/LIKE), `region`, `type` (`launch|landing|area`), `limit`, `offset`.
**Response 200** → `{ data: Spot[] }`:
```json
{ "data": [ { "id": 7, "name": "Wasserkuppe", "region": "Rhön", "country": "DE",
  "lat": 50.4986, "lng": 9.9436, "type": "launch" } ] }
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
| 5.9 | GET | `/meetups/{id}/weather` | öffentlich (throttled) |
| 5.10 | GET | `/meetups/{id}/briefing` | öffentlich (throttled) |

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
| `sort` | `starts_at_asc` (Default), `starts_at_desc`, `created_at_desc`, `participants_desc`, `title_asc` |
| `limit`, `offset` | Pagination (`limit` 1–200, Default 20) |

**Response 200** → `{ data: MeetupListItem[], meta: { total, limit, offset, sort } }`:
```json
{ "data": [ {
  "id": 12, "title": "Mosel-Soaring Sonntag", "spot_name": "Wasserkuppe",
  "region": "Rhön", "lat": 50.4986, "lng": 9.9436,
  "starts_at": "2026-07-05T09:00:00Z", "experience_level": "all",
  "max_participants": 15, "participant_count": 8, "free_spots": 7,
  "derived_status": "open"
} ] }
```

### 5.2 GET `/meetups/{id}`
Detail inkl. Teilnehmerliste, berechnetem Status, `is_participant`-Flag für `current_user`.

**Response 200** → `{ data: MeetupDetail }` (MeetupListItem + `spot_id`, `creator_user_id`, `description`, `conversation_id: int|null` (Treffen-Chat, wird beim Erstellen mit-angelegt), `participants: PublicUserCard[]`, `is_participant: bool`, `can_edit: bool`). Teilnehmer sortiert: Ersteller zuerst, dann `joined_at` aufsteigend. **Fehler:** `404 not_found` (auch bei nicht-sichtbarem group-scoped Treffen).

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
| `max_participants` | int\|null | `>=1` falls gesetzt; `null` = unbegrenzt |
| `group_id` | int\|null | optional group-scoped (Schema vorbereitet; UI deferred) |

`region`/`lat`/`lng`/`spot_name` werden **nicht** vom Client gesendet — der Server leitet sie aus `spot_id` ab.

**Response 201** → `{ data: MeetupDetail }`. **Fehler:** `422 validation_error` (`starts_at` in Vergangenheit → `fields.starts_at`; `max_participants < 1`; ungültiger Spot → `fields.spot_id`).

### 5.4 PATCH `/meetups/{id}`
Bearbeiten **oder Absagen** (`status: 'cancelled'`, soft, behält Historie). **Auth: Creator oder `admin`.** Felder wie 5.3 (alle optional); bei `spot_id`-Wechsel werden `spot_name`/`region`/`lat`/`lng` neu abgeleitet; `max_participants` darf nicht unter den aktuellen `participant_count`. **Response 200** → `{ data: MeetupDetail }`. **Fehler:** `403 forbidden`; `404 not_found`; `409 capacity_below_current`; `422 validation_error`.

### 5.5 DELETE `/meetups/{id}`
Hartes Löschen (kaskadiert `meetup_participants` + zugehörige `conversations` bewusst aufräumen, ADR-005). **Auth: Creator oder `admin`.** Bevorzugt jedoch „Absagen" via 5.4. **Response 204.** **Fehler:** `403 forbidden`; `404 not_found`.

### 5.6 POST `/meetups/{id}/participants`
„Teilnehmen": `current_user` beitreten. Transaktional mit Kapazitätsprüfung (UNIQUE `(meetup_id,user_id)`).

**Request:** leer (oder `{}`).
**Response 200** → `{ data: MeetupDetail }` — **idempotent**: frischer wie wiederholter Beitritt liefern den aktuellen Detail-Stand (kein Duplikat dank UNIQUE).
**Fehler:** `409 meetup_full`; `409 meetup_not_joinable` (abgesagt/abgeschlossen); `404 not_found`.

### 5.7 DELETE `/meetups/{id}/participants/me`
„Absagen": Selbst-Austritt (Button-Toggle). **Idempotent:** war der Nutzer nicht angemeldet ⇒ aktueller Stand statt `404`. **Response 200** → `{ data: MeetupDetail }`. **Ersteller-Sonderfall:** der Organisator kann nicht austreten ⇒ `409 creator_cannot_leave` (Treffen absagen/löschen).

### 5.8 DELETE `/meetups/{id}/participants/{userId}`
Admin/Creator entfernt Teilnehmer. **Auth: Creator oder `admin`.** Der Creator kann sich hierüber nicht selbst entfernen (`409 creator_cannot_leave`). **Response 200** → `{ data: MeetupDetail }`. **Fehler:** `403 forbidden`; `404 not_found`.

### 5.9 GET `/meetups/{id}/weather`
Wetter am Startplatz zur Startzeit (**Open-Meteo-Proxy**, ADR-017). **Öffentlich** (wie die übrigen Treffen-Reads), gedrosselt mit `throttle:weather,30` (30/min/IP), Antwort mit `ETag`/`304`. Koordinaten und Zeitpunkt stammen aus der Meetup-Zeile — **der Client übergibt keine Parameter**. Die Upstream-Antwort wird 30 min serverseitig gecacht.

**Response 200** → `{ data: MeetupWeather }`

```jsonc
{
  "available": true,              // false ⇒ snapshot: null, trend: []
  "reason": null,                 // "past" | "out_of_range" | "no_location" | null
  "is_current": false,            // true, wenn das Treffen bereits läuft (Ist-Wetter statt Prognose)
  "snapshot": {                   // WeatherHour — die Stunde des Treffen-Starts
    "at": "2026-07-12T10:00:00Z", // ISO-8601, UTC-Stundenraster
    "temperature_c": 22.0,
    "wind_speed_kmh": 10.2,       // Bodenwind 10 m — der wichtigste Wert
    "wind_gusts_kmh": 29.9,
    "wind_direction_deg": 32,     // meteorologisch: Richtung, *aus der* der Wind kommt
    "precipitation_probability_pct": 0,   // nullable (Modell-Lücke)
    "precipitation_mm": 0.0,
    "cloud_cover_pct": 0,
    "weather_code": 0,            // WMO
    "wind_1500m_kmh": 12.0,       // 850 hPa — nullable
    "wind_1500m_direction_deg": 240,      // nullable
    "cape_j_kg": 0.0              // Thermik-Indikator — nullable
  },
  "trend": [ /* ≤ 6 WeatherHour: 2 Stunden davor … 3 danach, an den Rändern der Zeitreihe beschnitten */ ]
}
```

**„Kein Wetter" ist kein Fehler:** vergangenes Treffen (`past`, 2 h Kulanz für laufende), jenseits des 16-Tage-Horizonts (`out_of_range`) oder ohne Koordinaten (`no_location`) ⇒ `200 { available: false, reason }` **ohne** Upstream-Call.
**Fehler:** `404 not_found`; `429 rate_limited`; `503 weather_unavailable` (Open-Meteo nicht erreichbar/fehlerhaft).

### 5.10 GET `/meetups/{id}/briefing`
KI-Flug-Briefing zu den Wetterdaten (**Gemini-Proxy**, ADR-018). **Öffentlich**, gedrosselt mit `throttle:briefing,10` (10/min/IP — LLM-Frei-Kontingent), Antwort mit `ETag`/`304`. Der Gemini-Key liegt nur serverseitig (`gemini.apiKey` in `.env`); in den Prompt fließen ausschließlich kuratierte Daten (kein Titel/keine Beschreibung → keine Prompt-Injection-Fläche). Ergebnis 30 min gecacht, Schlüssel an die Wetter-Zielstunde gekoppelt.

**Response 200** → `{ data: MeetupBriefing }`

```jsonc
{
  "available": true,               // false ⇒ text/generated_at: null
  "reason": null,                  // "past" | "out_of_range" | "no_location" | "not_configured" | null
  "text": "Am Startplatz weht …",  // 2–3 deutsche Sätze; beschreibt NUR die Daten, nie eine Flugfreigabe
  "generated_at": "2026-07-12T08:04:11Z"
}
```

**„Kein Briefing" ist kein Fehler:** Wetter-Gründe werden durchgereicht; fehlender API-Key ⇒ `not_configured` — jeweils `200` **ohne** Upstream-Call.
**Fehler:** `404 not_found`; `429 rate_limited`; `503 briefing_unavailable` (Gemini nicht erreichbar/Kontingent erschöpft/leere Antwort).

---

## 6. Gruppen

| # | Methode | Pfad | Auth |
|---|---|---|---|
| 6.1 | GET | `/groups` | öffentlich — **unpaginiert**, nur sichtbare (`public` + eigene Mitgliedschaften) |
| 6.2 | GET | `/groups/suggestions` | eingeloggt — **deferred** (kein Frontend-Hook in M4) |
| 6.3 | POST | `/groups` | eingeloggt |
| 6.4 | GET | `/groups/{id}` | Sichtbarkeit |
| 6.5 | PATCH | `/groups/{id}` | `owner`/`admin` |
| 6.6 | DELETE | `/groups/{id}` | `owner` |
| 6.7 | GET | `/groups/{id}/members` | Sichtbarkeit — **unpaginiert** |
| 6.8 | POST | `/groups/{id}/members` | eingeloggt (`join_policy=open`) — **Beitritt** |
| 6.8b | DELETE | `/groups/{id}/members` | Mitglied — **Selbst-Austritt** (kein `/me`-Suffix) |
| 6.9 | PATCH | `/groups/{id}/members/{userId}` | `owner`/`admin` — nur Rolle (`{role}`) |
| 6.9b | POST | `/groups/{id}/members/{userId}/ban` | `moderator`+ — Ban toggeln |
| 6.9c | POST | `/groups/{id}/transfer` | `owner` — Eigentum übertragen (`{user_id}`) |
| 6.10 | DELETE | `/groups/{id}/members/{userId}` | `owner`/`admin`/`moderator` — Kick |
| 6.11 | POST | `/groups/{id}/join-requests` | eingeloggt (`join_policy=request`) |
| 6.11b | DELETE | `/groups/{id}/join-requests/mine` | Antragsteller — eigenen Antrag zurückziehen |
| 6.12 | GET | `/groups/{id}/join-requests` | `owner`/`admin` |
| 6.13 | POST | `/groups/{id}/join-requests/{requestId}/approve` | `owner`/`admin` |
| 6.13b | POST | `/groups/{id}/join-requests/{requestId}/reject` | `owner`/`admin` |
| 6.14 | POST | `/groups/{id}/invites` | `owner`/`admin` |
| 6.15 | GET | `/groups/{id}/invites` | `owner`/`admin` |
| 6.16 | DELETE | `/groups/{id}/invites/{inviteId}` | `owner`/`admin` |
| 6.17 | GET | `/invites/{token}` | öffentlich (Preview) — **UI deferred (Backend + Test vorhanden)** |
| 6.18 | POST | `/invites/{token}/accept` | eingeloggt — **UI deferred (Backend + Test vorhanden)** |

> **Zwei orthogonale Achsen** (ADR-006): `visibility` ∈ `public|private|unlisted`, `join_policy` ∈ `open|request|invite_only`. Default neuer Gruppen: `public` + `open`. Beitritt/Einladung sind **getrennte** Tabellen (`group_join_requests` vs. `group_invites`), nicht eine `join_requests`-Tabelle.

### 6.1 GET `/groups`
Verzeichnis. **Unpaginierte** Liste (Frontend nutzt `apiFetch` + `groupListSchema`, kein `meta`).
Server filtert nur nach **Sichtbarkeit**: Gast → nur `public`; eingeloggt → `public` ∪ Gruppen, in
denen man **aktives** Mitglied ist (so erscheinen eigene `private`/`unlisted`). `unlisted` nie im
Verzeichnis für Nicht-Mitglieder; soft-deleted ausgeschlossen. **Such-/Region-Filter laufen
client-seitig** (keine Query-Parameter).
**Response 200** → `{ data: GroupListItem[] }`:
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

**Request** (Frontend sendet **kein** `slug` → immer auto aus `name`)
| Feld | Typ | Regel |
|---|---|---|
| `name` | string | `min(3).max(80)` — **nicht** UNIQUE (nur `slug` ist eindeutig, DATA_MODEL §5.1) |
| `description` | string\|null | `max(2000)` |
| `region` | string\|null | `max(80)` |
| `tags` | string[]\|null | je `max(30)`, max 8 |
| `rules_text` | string\|null | `max(5000)` |
| `visibility` | enum | `public`(Default)\|`private`\|`unlisted` |
| `join_policy` | enum | `open`(Default)\|`request`\|`invite_only` |

`slug` wird serverseitig aus `name` generiert (`^[a-z0-9-]{3,60}$`, kollisionssicher eindeutig).
**Response 201** → `{ data: GroupDetail }` (volles Detail, **nicht** ein gekürztes Objekt). **Fehler:** `422 validation_error`; `409 slug_taken`.

### 6.4 GET `/groups/{id}`
Detail/Metadaten (Adressierung per numerischer **`id`**, nicht `slug`). Sichtbarkeit je
`visibility`+Mitgliedschaft: `public`/`unlisted` → für alle sichtbar (unlisted per Link/ID); `private`
→ Mitglieder voll, **Nicht-Mitglieder erhalten die „Existenz-Karte"** (Metadaten + Beitritts-CTA,
`my_membership=null`) statt `404`. **Feed** ist bei `visibility != private` öffentlich lesbar (ADR-006).
**Response 200** → `{ data: GroupDetail }` = `GroupListItem` + `rules_text`, `owner_user_id`,
`my_membership: { role, status } | null`, `can_manage: bool`, `has_pending_request: bool`.

### 6.5 PATCH `/groups/{id}`
Metadaten bearbeiten (Felder wie 6.3, alle optional; `slug` bleibt unverändert). **Auth: `owner`/`admin`.** **Fehler:** `403 forbidden_role`; `422 validation_error`.

### 6.6 DELETE `/groups/{id}`
Soft-Delete (`deleted_at`). **Auth: nur `owner`.** Zugehörige `conversations` (Channels) bewusst aufräumen. **Response 204.** **Fehler:** `403 forbidden`.

### 6.7 GET `/groups/{id}/members`
Mitgliederliste mit Rollen. Sichtbarkeit je `visibility` (private nur für Mitglieder). **Unpaginiert.**
**Response 200** → `{ data: GroupMember[] }` (`{ user: PublicUserCard, role, status, joined_at }`).

### 6.8 POST `/groups/{id}/members`
Direkter Beitritt **nur** bei `join_policy=open`. Erzeugt `group_members` (`role=member`, `status=active`),
inkrementiert `members_count`. Idempotent gegen Doppelklick (`uq_group_user`).

**Response 200** → `{ data: GroupDetail }` (frisches Detail mit `my_membership`).
**Fehler:** `409 already_member`; `409 join_policy_mismatch` (request/invite_only → stattdessen 6.11/Invite); `403 group_member_banned`.

### 6.8b DELETE `/groups/{id}/members`
Selbst-Austritt (kein `/me`-Suffix). Idempotent (kein Mitglied ⇒ aktueller Stand). Der **Owner** kann
nicht austreten (`409 owner_must_transfer` → erst Eigentum übertragen). Dekrementiert `members_count`.
**Response 200** → `{ data: GroupDetail }`.

### 6.9 PATCH `/groups/{id}/members/{userId}`
**Rolle ändern** (nur Rolle — Ban und Transfer haben eigene Endpunkte, s. 6.9b/6.9c). **Auth: `owner`/`admin`.**
Hierarchie: `admin` befördert max. bis `moderator`; nur `owner` vergibt `admin`; keine Selbst-Beförderung;
Owner-Rolle nur per Transfer; Moderation nie gegen ranghöhere Rolle.

**Request:** `{ role: 'admin'|'moderator'|'member' }`
**Response 200** → `{ data: GroupMember[] }` (aktualisierte Mitgliederliste).
**Fehler:** `403 forbidden_role`; `404 not_found`.

### 6.9b POST `/groups/{id}/members/{userId}/ban`
Ban toggeln (`status` ↔ `active`/`banned`). **Auth: `moderator`+.** Nicht gegen Owner/ranghöhere Rolle.
**Response 200** → `{ data: GroupMember[] }`. **Fehler:** `403 forbidden_role`.

### 6.9c POST `/groups/{id}/transfer`
**Eigentumsübertragung.** **Auth: nur `owner`.** Ziel muss aktives Mitglied sein; alter Owner → `admin`,
Ziel → `owner` (transaktional, **genau ein Owner**).
**Request:** `{ user_id: int }`
**Response 200** → `{ data: GroupMember[] }`. **Fehler:** `403 forbidden_role`; `404 not_found`.

### 6.10 DELETE `/groups/{id}/members/{userId}`
**Kick** durch `owner`/`admin`/`moderator` (nicht gegen ranghöhere Rolle; nicht den Owner). Für den
Selbst-Austritt s. 6.8b.
**Response 200** → `{ data: GroupMember[] }`. **Fehler:** `403 forbidden_role`; `404 not_found`.

### 6.11 POST `/groups/{id}/join-requests`
Beitrittsantrag (`join_policy=request`) mit optionaler Begründung. Offener `pending`-Antrag wird
wiederverwendet (kein Duplikat). Ban wird geprüft.
**Request:** `{ message?: string.max(500) }`
**Response 200** → `{ data: GroupDetail }` (mit `has_pending_request=true`).
**Fehler:** `409 already_member`; `403 group_member_banned`; `409 join_policy_mismatch`.

### 6.11b DELETE `/groups/{id}/join-requests/mine`
Eigenen offenen Antrag zurückziehen (`pending` → `cancelled`). Idempotent.
**Response 200** → `{ data: GroupDetail }` (mit `has_pending_request=false`).

### 6.12 GET `/groups/{id}/join-requests`
Offene Anträge (Default `pending`). **Auth: `owner`/`admin`.** **Response 200** → `{ data: JoinRequest[] }`.

### 6.13 POST `/groups/{id}/join-requests/{requestId}/approve`
Genehmigen. **Auth: `owner`/`admin`.** Erzeugt `group_members`-Eintrag transaktional (+ `members_count++`,
`decided_by`/`decided_at`).
**Response 200** → `{ data: JoinRequest[] }` (verbleibende offene Anträge). **Fehler:** `403 forbidden_role`; `404 not_found`.

### 6.13b POST `/groups/{id}/join-requests/{requestId}/reject`
Ablehnen (`status=rejected`, `decided_by`/`decided_at`). **Auth: `owner`/`admin`.**
**Response 200** → `{ data: JoinRequest[] }`. **Fehler:** `403 forbidden_role`; `404 not_found`.

### 6.14 POST `/groups/{id}/invites`
Einladung: gerichtet an Nutzer **ODER** teilbarer Token-Link. **Auth: `owner`/`admin`.**

**Request**
| Feld | Typ | Regel |
|---|---|---|
| `invited_user_id` | int\|null | gerichtete Einladung (exklusiv zu `token`-Modus) |
| `expires_at` | datetime\|null | nur Token-Link |
| `max_uses` | int\|null | nur Token-Link, `>=1` |

**Response 200** → `{ data: GroupInvite[] }` (aktualisierte Liste; Token-Invite inkl. `token`). **Fehler:** `422 validation_error`; `409 already_member`.

### 6.15 GET `/groups/{id}/invites`
Einladungen der Gruppe. **Auth: `owner`/`admin`.** **Response 200** → `{ data: GroupInvite[] }`.

### 6.16 DELETE `/groups/{id}/invites/{inviteId}`
Widerrufen (`status=revoked`). **Auth: `owner`/`admin`.** **Response 200** → `{ data: GroupInvite[] }`.

### 6.17 GET `/invites/{token}`
Öffentliche Preview vor Annahme (Gruppenname/Info). **Response 200** → `{ data: { group: GroupListItem, valid: bool, expired: bool, uses_left: int|null } }`. **Fehler:** `404 invite_not_found`.

### 6.18 POST `/invites/{token}/accept`
Token einlösen → `group_members`-Eintrag, falls gültig/nicht abgelaufen/`uses` verfügbar; inkrementiert `uses_count`; Ban wird geprüft. **Auth: eingeloggt.** **Response 201** → `{ data: GroupMember }`. **Fehler:** `410 invite_expired`; `409 invite_exhausted` (max_uses); `409 invite_revoked`; `403 group_member_banned`; `409 already_member`. *(UI-Verdrahtung deferred; Backend + PHPUnit in M4.)*

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
Channels der Gruppe = `conversations(type='group_channel')`, gefiltert nach **Mitgliedschaft + `min_role`**
(`member` sieht nur `min_role='member'`-Channels; `min_role='admin'`-Channels nur `owner`/`admin` — auch
`moderator` **nicht**, ADR-012/B4). `{channelId}` ist die `conversation_id`. **Response 200** → `{ data: Channel[] }`:
```json
{ "data": [ { "conversation_id": 88, "name": "Allgemein", "is_default": true, "unread_count": 0 } ] }
```
`unread_count` ist in M4 stets `0` (Messages erst M5). **Fehler:** `403 forbidden_role` / `404 group_not_found`.

### 7.2 POST `/groups/{id}/channels`
Legt einen `conversations`-Channel an (Mitgliedschaft über `group_members` abgeleitet; `position`=max+1). **Auth: `owner`/`admin`.**
**Request:** `{ name: string.min(1).max(80) }`
**Response 200** → `{ data: Channel[] }` (aktualisierte Liste). **Fehler:** `403 forbidden_role`; `422 validation_error`.

### 7.3 PATCH `/groups/{id}/channels/{channelId}`
Umbenennen. **Auth: `owner`/`admin`.** **Request:** `{ name: string }` **Response 200** → `{ data: Channel[] }`.

### 7.4 DELETE `/groups/{id}/channels/{channelId}`
Soft-Delete — **nicht** den Default- oder letzten Channel. **Auth: `owner`/`admin`.**
**Response 200** → `{ data: Channel[] }`. **Fehler:** `409 default_channel_not_deletable`; `409 last_channel_not_deletable`; `403 forbidden_role`.

---

## 8. Feed (Gruppen-Feed)

Admin-Broadcast (ADR-006/Gruppen-Empfehlung), **öffentlich lesbar** auch für Nicht-Mitglieder, sofern
`group.visibility != private`. **Emoji-Reaktionen** (eingeloggt) sind im MVP enthalten (DATA_MODEL §5.4.1,
ADR-012); Kommentare nicht. Eigene Tabelle `feed_posts` (+ `feed_post_reactions`; kein `conversations`-Typ;
`group_feed` deferred).

| # | Methode | Pfad | Auth |
|---|---|---|---|
| 8.1 | GET | `/groups/{id}/feed` | öffentlich (sofern visibility≠private) |
| 8.2 | POST | `/groups/{id}/feed` | `owner`/`admin` |
| 8.3 | PATCH | `/groups/{id}/feed/{postId}` | `owner`/`admin` |
| 8.4 | DELETE | `/groups/{id}/feed/{postId}` | `moderator`+ |
| 8.5 | POST | `/groups/{id}/feed/{postId}/reactions` | eingeloggtes Mitglied — Emoji toggeln |
| 8.6 | POST | `/groups/{id}/feed/{postId}/pin` | `owner`/`admin` — Pin toggeln |

### 8.1 GET `/groups/{id}/feed`
**Unpaginiert** (Frontend `apiFetch` + `feedPostListSchema`); Sortierung **pinned-first, dann
`created_at DESC`**; soft-deleted ausgeschlossen. `author` ist eine `PublicUserCard`; `reactions` sind
aggregiert (`{ emoji, count, me }`). **Response 200** → `{ data: FeedPost[] }`:
```json
{ "data": [ { "id": 51, "group_id": 3,
  "author": { "id": 42, "display_name": "Lena", "handle": "lena", "avatar_path": null },
  "title": "Saisonstart", "body": "…", "image_path": null, "is_pinned": true,
  "created_at": "2026-06-01T08:00:00Z", "updated_at": null,
  "reactions": [ { "emoji": "🪂", "count": 3, "me": true } ] } ] }
```

### 8.2 POST `/groups/{id}/feed`
**Auth: `owner`/`admin`** (`author_user_id` serverseitig geprüft). **Request:** `{ title?: string.max(150), body: string.min(1).max(5000) }`. **Response 201** → `{ data: FeedPost }`. **Fehler:** `403 forbidden_role`; `422 validation_error`.

### 8.3 PATCH `/groups/{id}/feed/{postId}`
Bearbeiten. **Auth: `owner`/`admin`.** **Response 200** → `{ data: FeedPost }`.

### 8.4 DELETE `/groups/{id}/feed/{postId}`
Soft-Delete (`deleted_at`, `deleted_by`; kein Tombstone). **Auth: `moderator`+** (fremde Posts moderieren). **Response 204.**

### 8.5 POST `/groups/{id}/feed/{postId}/reactions`
Emoji-Reaktion toggeln (`uq_feed_reaction`). **Auth: eingeloggtes Mitglied.** **Request:** `{ emoji: string }`. **Response 200** → `{ data: FeedPost }` (mit aktualisierten `reactions`).

### 8.6 POST `/groups/{id}/feed/{postId}/pin`
`is_pinned` toggeln. **Auth: `owner`/`admin`.** **Response 200** → `{ data: FeedPost }`.

---

## 9. Chat – Conversations

Generische polymorphe Engine (ADR-005): `conversations(type, context_type, context_id)` + `conversation_participants` + `messages` für **alle** Chat-Orte. `type` ∈ `group_channel|meetup|direct`. Autorisierung pro Konversationstyp: DM → `conversation_participants`; `group_channel` → aktives `group_members` (+ `min_role`); `meetup` → `meetup_participants` (BOLA, ADR-004). `conversation_participants` trägt für Channels/Treffen nur Watermark/`muted`; die Sichtbarkeit ist mitgliedschaftsgetrieben.

> **Vertrag = committetes Frontend** (`frontend/src/api/chat.ts`, `api/schemas/chat.ts`). Die früheren REST-„Aufräumungen" (eigenes `POST /conversations` mit `target_user_id`, top-level `/messages/{id}`, `PUT/DELETE …/reactions/{emoji}`) sind zugunsten der ausgelieferten, einfacheren Form **zurückgenommen** (Audit-Trail §13).

| # | Methode | Pfad | Auth |
|---|---|---|---|
| 9.1 | GET | `/conversations` | eingeloggt |
| 9.2 | GET | `/conversations/unread-count` | eingeloggt |
| 9.3 | POST | `/conversations/direct` | eingeloggt |
| 9.4 | GET | `/conversations/{id}` | Teilnehmer |
| 9.5 | POST | `/conversations/{id}/read` | Teilnehmer |

Alle Chat-Endpunkte liegen **im Auth-Filter** (privat, kein Gast-Zugriff).

### 9.1 GET `/conversations`
Konversationen des Nutzers (DMs ∪ Channels eigener Gruppen∩`min_role` ∪ eigene Treffen-Chats) mit letzter Nachricht + Ungelesen-Zähler, sortiert nach `last_message_at DESC`. **Unpaginiert** (keine Query-Params). Polling-fähig (`ETag`/`304`).
**Response 200** → `{ data: ConversationListItem[] }`:
```json
{ "data": [ { "id": 88, "type": "direct", "title": "Tom Berg",
  "peer": { "id": 7, "display_name": "Tom Berg", "handle": "tom", "avatar_path": null },
  "last_message": { "body": "bis morgen!", "sender_name": "Tom Berg", "created_at": "2026-06-18T20:00:00Z" },
  "unread_count": 2, "last_message_at": "2026-06-18T20:00:00Z" } ] }
```
`peer` ist nur bei `direct` gesetzt (DM-Gegenüber); bei Channel/Treffen `null`. `title`: DM = Peer-Name, `meetup` = Treffen-Titel, `group_channel` = `"{Gruppe} · {Channel}"`.

### 9.2 GET `/conversations/unread-count`
Schlanker Aggregat-Zähler (Summe ungelesener Nachrichten über alle Konversationen) für das Nav-Badge. Polling, `ETag`/`304`. **Response 200** → `{ data: 7 }` (bare Zahl).

### 9.3 POST `/conversations/direct`
**Find-or-create** einer DM (deterministischer `dm_key = min(a,b):max(a,b)`, transaktional, ADR-005). **Request:** `{ user_id: int }`. **Response 200** → `{ data: { id: int } }` (existierende oder neu angelegte Konversation; idempotent). **Fehler:** `422 validation_error`; `404 user_not_found`; `409 cannot_dm_self`.

### 9.4 GET `/conversations/{id}`
Metadaten + Teilnehmer (nach Zugriffsprüfung). **Response 200** → `{ data: ConversationDetail }` = `{ id, type, title, peer: PublicUserCard|null, participants: PublicUserCard[], creator_user_id: int|null }` (`creator_user_id` nur bei `type=meetup`, für die Ersteller-Hervorhebung). **Fehler:** `403 not_a_participant` / `404 not_found`.

### 9.5 POST `/conversations/{id}/read`
Markiert alles als gelesen: Server setzt `last_read_message_id` = letzte Nachricht der Konversation (kein Request-Body) und löst die aggregierte `new_message`-Notification dieser Konversation auf (ADR-012/C7). **Response 204.** **Fehler:** `403 not_a_participant`.

---

## 10. Messages

Senden, Verlauf, Soft-Edit/Delete, Reaktionen (ADR-009: Chat-MVP „Mittel"). Nachrichten sind **Plaintext + Auto-Linkify** (ADR-011, kein Markdown/HTML). Persistenz immer in MySQL (Source of Truth); Live via Polling. Alle Routen sind **unter `/conversations/{id}/messages`** verschachtelt (`id` = `conversation_id`); top-level `/messages/{id}` entfällt (Frontend-Vertrag).

| # | Methode | Pfad | Auth |
|---|---|---|---|
| 10.1 | GET | `/conversations/{id}/messages` | Teilnehmer |
| 10.2 | POST | `/conversations/{id}/messages` | Teilnehmer (Schreibrecht) |
| 10.3 | PATCH | `/conversations/{id}/messages/{messageId}` | nur Sender |
| 10.4 | DELETE | `/conversations/{id}/messages/{messageId}` | Sender oder Conversation-`owner`/`admin` |
| 10.5 | POST | `/conversations/{id}/messages/{messageId}/reactions` | Teilnehmer (Toggle) |

### 10.1 GET `/conversations/{id}/messages`
Liefert den **vollständigen** Verlauf (kein Cursor/Pagination im MVP — Threads sind seed-klein; Keyset `before_id`/`since_id`-Delta sind **deferred**, kein Frontend-Konsument). Polling-Endpunkt, unterstützt `If-None-Match` → `304`.
**Response 200** → `{ data: Message[] }`:
```json
{ "data": [ { "id": 9001, "conversation_id": 88,
  "sender": { "id": 7, "display_name": "Tom", "handle": "tom", "avatar_path": null },
  "body": "bis morgen!", "reply_to": null, "is_creator": false,
  "created_at": "2026-06-18T20:00:00Z", "edited_at": null, "deleted_at": null,
  "reactions": [ { "emoji": "👍", "count": 2, "me": true } ] } ] }
```
`sender` ist eine `PublicUserCard` (`id`). `reply_to` ist eine eingebettete Vorschau `{ id, sender_name, body }|null`. Gelöschte Nachrichten als Tombstone (`deleted_at` gesetzt, `body: null`), bleiben für die Reply-Verankerung im Verlauf. `is_creator` = abgeleitetes Flag (`sender_id == meetup.creator_user_id` bei `type=meetup`, ADR-005). **Fehler:** `403 not_a_participant`.

### 10.2 POST `/conversations/{id}/messages`
**Request:** `{ body: string.min(1).max(4000), reply_to_id?: int|null }`
**Response 201** → `{ data: Message }`.
**Fehler:** `422 validation_error`; `403 not_a_participant`; `403 insufficient_role` (`min_role`); `409 reply_target_not_found`.

### 10.3 PATCH `/conversations/{id}/messages/{messageId}`
Soft-Edit (`edited_at`). **Auth: nur eigener Sender, innerhalb 15 min ab `created_at`** (ADR-012/C6). **Request:** `{ body: string.min(1).max(4000) }`. **Response 200** → `{ data: Message }`. **Fehler:** `403 forbidden`; `409 message_deleted`; `409 edit_window_expired`.

### 10.4 DELETE `/conversations/{id}/messages/{messageId}`
Soft-Delete (`deleted_at`; bei Moderation `deleted_by`; `body` bleibt in der DB für Audit, wird aber als `null` ausgeliefert). **Auth: Sender oder Conversation-`owner`/`admin`.** **Response 200** → `{ data: Message }` (Tombstone, **nicht** 204 — das Frontend ersetzt die Nachricht im Cache). **Fehler:** `403 forbidden`; `404 not_found`.

### 10.5 POST `/conversations/{id}/messages/{messageId}/reactions`
Emoji-Reaktion **togglen** (an/aus; UNIQUE `(message_id,user_id,emoji)`; stößt `messages.updated_at` an, damit Polling die Änderung sieht). **Request:** `{ emoji: string }` (Server-Allowlist). **Response 200** → `{ data: Message }` (ganze Nachricht mit aktualisierten `reactions`). **Fehler:** `403 not_a_participant`; `409 message_deleted`; `422 invalid_emoji`.

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
Alle Benachrichtigungen des Nutzers, neueste zuerst. **Unpaginiert.** Polling, `ETag`/`304`. **Response 200** → `{ data: Notification[] }`:
```json
{ "data": [ { "id": 301, "type": "meetup_join",
  "actor": { "id": 7, "display_name": "Tom", "handle": "tom", "avatar_path": null },
  "text": "Tom nimmt an deinem Treffen „Mosel-Soaring\" teil.",
  "link": "/flugtreffen/12", "read_at": null, "created_at": "2026-06-18T19:00:00Z" } ] }
```
`text` (deutsch) und `link` werden **serverseitig im Presenter** aus `type` + `actor` + `data`(JSON) erzeugt — das Frontend rendert nur. `actor` ist eine `PublicUserCard|null`.

### 11.2 GET `/notifications/unread-count`
Schlanker Zähler-Endpunkt für die Badge (Polling, `ETag`/`304`, ADR-001). **Response 200** → `{ data: 3 }` (bare Zahl).

### 11.3 POST `/notifications/{id}/read`
Einzelne als gelesen markieren (`read_at`). **Response 200** → `{ data: Notification[] }` (die **ganze** aktualisierte Liste — das Frontend ersetzt den Cache ohne Nachladen). **Fehler:** `403 forbidden` (fremde Notification); `404 not_found`.

### 11.4 POST `/notifications/read-all`
Alle als gelesen markieren. **Response 200** → `{ data: Notification[] }` (ganze Liste).

> **✅ Entschieden (ADR-012/C8 + Frontend-Vertrag):** `notifications.type` ist `VARCHAR` (erweiterbar). MVP-Satz = **das Frontend-Enum** (`api/schemas/notifications.ts`): `meetup_join`, `meetup_cancelled`, `group_join_request`, `group_request_approved`, `group_invite`, `new_message`, `message_reaction`, `group_feed_post`. `message_received` heißt im ausgelieferten Vertrag **`new_message`**; `meetup_updated`/`group_role_changed` sind **out of scope** (kein Frontend-Rendering → würden von Zod verworfen). Aggregation für `new_message`: **eine** ungelesene Notification pro Konversation, beim Lesen aufgelöst (ADR-012/C7).

---

## 11b. Admin (ADR-019)

Plattform-Verwaltung unter `/admin/*`, Filter `['csrf','auth','admin']` — die Shield-Gruppe `admin`
ist Pflicht, sonst `403 forbidden`. Alle Antworten ohne `ETag`/`304` (hier pollt nichts).

**Bewusst nicht hier:** Schreibrouten für Treffen und Gruppen. `PATCH/DELETE /meetups/{id}` bzw.
`/groups/{id}` akzeptieren Admins längst über den `$isAdmin`-BOLA-Override im Service — die Admin-UI
ruft diese. Ebenso **keine** Inhalts-Moderation (ADR-005 gibt dem Chat keinen Admin-Override).

| # | Methode | Pfad | Auth |
|---|---|---|---|
| 11b.1 | GET | `/admin/stats` | admin |
| 11b.2 | GET | `/admin/users` | admin |
| 11b.3 | GET | `/admin/users/{id}` | admin |
| 11b.4 | PATCH | `/admin/users/{id}` | admin |
| 11b.5 | POST | `/admin/users/{id}/admin` | admin |
| 11b.6 | POST | `/admin/users/{id}/active` | admin |
| 11b.7 | DELETE | `/admin/users/{id}` | admin |
| 11b.8 | POST | `/admin/users/{id}/restore` | admin |
| 11b.9 | GET | `/admin/meetups` | admin |
| 11b.10 | GET | `/admin/groups` | admin |
| 11b.11 | POST | `/admin/groups/{id}/restore` | admin |
| 11b.12 | GET | `/admin/spots` | admin |
| 11b.13 | POST | `/admin/spots` | admin |
| 11b.14 | PATCH | `/admin/spots/{id}` | admin |
| 11b.15 | DELETE | `/admin/spots/{id}` | admin |

### 11b.1 GET `/admin/stats`
Kennzahlen der Instanz. **Response 200** → `{ data: AdminStats }`:
```json
{ "data": { "users":   { "total": 16, "active": 15, "suspended": 0, "deleted": 1, "admins": 1, "new_7d": 2 },
            "meetups": { "total": 18, "upcoming": 5, "cancelled": 2 },
            "groups":  { "total": 8, "active": 8, "deleted": 0, "private": 2 },
            "spots":   { "total": 30 } } }
```

### 11b.2 GET `/admin/users`
Alle Konten — **standardmäßig inklusive soft-gelöschter**: eine Admin-Liste zeigt die Wahrheit.
Query: `q` (Name/Handle/**E-Mail**), `status` (`active|suspended|deleted|admins`), `sort`
(`created_at_desc|created_at_asc|name_asc|email_asc|last_active_desc`), `limit` (≤200), `offset`.
**Response 200** → `{ data: AdminUserRow[], meta: { total, limit, offset, sort } }`:
```json
{ "data": [ { "id": 3, "display_name": "Lena Krüger", "handle": "lena_xc", "avatar_path": null,
              "email": "lena@flightmeet.test", "is_admin": false, "active": true,
              "created_at": "2026-06-26T10:00:00Z", "last_active": null, "deleted_at": null,
              "meetups_count": 4, "groups_count": 2 } ],
  "meta": { "total": 16, "limit": 20, "offset": 0, "sort": "created_at_desc" } }
```
`email` stammt aus `auth_identities` (nicht aus `profiles`); `is_admin` wird per JOIN auf
``auth_groups_users.`group` = 'admin'`` aufgelöst (kein `inGroup()` je Zeile → kein N+1).

### 11b.3 GET `/admin/users/{id}` · 11b.4 PATCH `/admin/users/{id}`
Detail = Zeile + `bio_markdown`, `experience_level`, `license_class`, `glider`, `home_region`,
`flight_hours`, `is_self`. PATCH ändert dieselben Profilfelder wie `PATCH /me/profile` (gleiche
Regeln, `409 handle_taken`). **`email` ist read-only** — sie liegt in `auth_identities`, ihre Änderung
hieße Identity + Verifikation + Eindeutigkeit; E-Mail-Flows sind laut ADR-008 out of scope.

### 11b.5–11b.8 Rolle, Sperre, Soft-Delete, Restore
Bodies: `{ "is_admin": bool }` bzw. `{ "active": bool }`. **Alle vier antworten mit dem frischen
`AdminUserDetail`** (kein 204) — das Frontend aktualisiert damit die Zeile direkt.

`DELETE` ist Shields **Soft-Delete** (`deleted_at`), `restore` hebt ihn auf. Ein gesperrtes Konto
verliert seine laufende Session beim nächsten Request (`ApiAuthFilter` → `403 account_suspended`);
ein soft-gelöschtes verliert sie, weil Shields Provider es nicht mehr findet.

**Selbstschutz** → `409` (nicht 403 — die Rechte fehlen nicht, das Ziel ist ungültig):

| Code | Wann |
|---|---|
| `admin_self_demote` | `is_admin:false` auf sich selbst |
| `admin_self_deactivate` | `active:false` auf sich selbst |
| `admin_self_delete` | `DELETE` auf sich selbst |

Daraus folgt die Invariante **≥ 1 Admin** (der Handelnde ist per Filter Admin und kann sich nicht
selbst entfernen). Sich selbst *befördern* ist ein harmloser No-Op und bleibt erlaubt.

### 11b.9 GET `/admin/meetups`
Nutzt `MeetupService::list()` unverändert (Treffen haben weder Sichtbarkeit noch Soft-Delete — die
öffentliche Abfrage *ist* die Admin-Abfrage). Query wie `/meetups`. Zeigt **beides**: den
persistierten `status` (`open|cancelled`) und den beim Lesen abgeleiteten `derived_status`.
```json
{ "data": [ { "id": 12, "title": "Morgenthermik Wallberg", "spot_name": "Wallberg", "region": "Bayern",
              "starts_at": "2026-08-01T07:00:00Z", "status": "open", "derived_status": "open",
              "participant_count": 5, "max_participants": 8,
              "creator": { "id": 3, "display_name": "Lena Krüger", "handle": "lena_xc", "avatar_path": null },
              "created_at": "2026-07-01T09:00:00Z" } ],
  "meta": { "total": 18, "limit": 20, "offset": 0, "sort": "starts_at_asc" } }
```

### 11b.10 GET `/admin/groups` · 11b.11 POST `/admin/groups/{id}/restore`
**Ohne** Sichtbarkeits- und **ohne** Soft-Delete-Filter — private, nicht gelistete und gelöschte
Gruppen inklusive; genau dafür existiert die Route (eigene Abfrage neben `GroupService::list()`,
Begründung in ADR-019). Query: `q`, `visibility`, `status` (`active|deleted`), `sort`, `limit`, `offset`.
```json
{ "data": [ { "id": 4, "name": "Chiemgau Flieger", "slug": "chiemgau-flieger", "visibility": "private",
              "join_policy": "request", "members_count": 6,
              "owner": { "id": 2, "display_name": "Markus Weber", "handle": "markus", "avatar_path": null },
              "created_at": "2026-06-26T10:00:00Z", "deleted_at": null } ] }
```
`restore` (→ **204**) hebt den Soft-Delete der Gruppe **und ihrer Channels** auf; `409
group_not_deleted`, wenn sie gar nicht gelöscht ist.

### 11b.12–11b.15 Startplätze
Löst ADR-012/A4 ein („nur Admin/Seed pflegen die Liste"). Query: `q`, `region`, `type`, `sort`, `limit`,
`offset`. Create → **201**, Update → **200** (beide mit `AdminSpot`), Delete → **204**.
```json
{ "data": { "id": 7, "name": "Wallberg", "region": "Bayern", "country": "DE",
            "lat": 47.7042, "lng": 11.7583, "type": "launch",
            "description": "Klassiker am Tegernsee.", "meetups_count": 3 } }
```
Regeln: `name` 2–150, `region` ≤80, `country` 2 Buchstaben (default `DE`, serverseitig uppercase),
`lat` −90…90, `lng` −180…180, `type` ∈ `launch|landing|area`, `description` ≤2000 → `422` mit
`error.fields`. **Löschen ist ein Hard-Delete und unbedenklich:** `meetups.spot_id` ist
`ON DELETE SET NULL`, Ort und Koordinaten liegen als Schnappschuss auf der Treffen-Zeile — das Treffen
behält Ortsangabe, Karte und Wetter (ADR-017 liest lat/lng vom Treffen), nur die Verknüpfung entfällt.
Deshalb kein `409 spot_in_use`, sondern `meetups_count` im UI + Hinweis im Dialog.

> **Typ-Vertrag:** `active`/`is_admin` sind echte Booleans, Zähler und `SUM()`-Werte echte Zahlen,
> `lat`/`lng` echte Floats. MySQL liefert all das roh als `0`/`1` bzw. String — die Presenter casten,
> und `frontend/src/api/schemas/admin.test.ts` hält genau das fest.

---

## 12. Uploads (Querschnitt)

> **Deferred — nicht implementiert.** Der einzige Upload im MVP ist der Avatar (§3.4 `POST /me/avatar`,
> mit Normalisierung auf 512/128 px WebP). Ein generischer `POST /uploads` für Gruppen-Logo und
> Feed-Bild war hier skizziert, hat aber keine UI bekommen (`groups.logo_path` / `feed_posts.image_path`
> existieren im Schema und in den DTOs, bleiben ohne Upload-Fläche jedoch `null`) — der Endpunkt wurde
> deshalb nie gebaut. Die Skizze bleibt als Ausbaupfad dokumentiert:

### 12.1 POST `/uploads` *(deferred)*
Generischer Datei-Upload (Gruppen-Logo, Feed-Bild). Validiert MIME (`image/jpeg|png|webp`) + Größe (≤5 MB), randomisiert Dateinamen, schreibt nach `public/media/...` (vom Vite-`emptyOutDir` geschützt, ADR-002), gibt Pfad zurück.

**Request:** `multipart/form-data`, Feld `file`, optional `purpose` (`group_logo|feed_image`).
**Response 201** → `{ data: { path: "/media/uploads/ab12.webp", mime_type, size_bytes } }`.
**Fehler:** `422 validation_error`; `400 file_too_large`; `415 unsupported_media_type`.

---

## 13. Audit-Trail (aufgelöste Widersprüche)

| # | Quelle(n) | Widerspruch | Auflösung | Begründung |
|---|---|---|---|---|
| 1 | auth-profil, chat | Bearer/JWT-Token; `auth_tokens`-Tabelle; HttpOnly-JWT-Cookie | **Shield Session-Cookie**, kein Bearer/JWT, kein `auth_tokens` | ADR-004 |
| 2 | mehrere | Pfade teils ohne `/v1` (`/api/auth/...`) | Einheitlich **`/api/v1`** | backend-deploy offene Frage |
| 3 | flugtreffen, chat | `/realtime/auth`, Pusher/Supabase-Trigger | **gestrichen**; Polling-only | ADR-001 |
| 4 | flugtreffen | `status` `geplant\|laeuft\|abgesagt\|beendet` | persistiert **`open\|cancelled`**, `full`/`finished` berechnet | ADR-002, DATA_MODEL |
| 5 | flugtreffen vs. backend-deploy | `experience_level` `anfaenger\|fortgeschritten\|profi/experte` | **`beginner\|advanced\|expert`** (+`all` nur Meetup) | DATA_MODEL-Vereinheitlichung |
| 6 | backend-deploy | `POST/DELETE /meetups/{id}/join`; `meetup_participants.status` `zugesagt\|vielleicht\|abgesagt` | **`/meetups/{id}/participants`** Sub-Resource; **kein `status`-Feld** (Teilnahme = Zeile existiert; keine Warteliste) | konsistent zu Gruppen-Beitritt, DATA_MODEL, ADR-015 |
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
| 17 | chat (M5) | REST-„Aufräumungen": `POST /conversations {target_user_id}`, top-level `/messages/{id}`, `PUT/DELETE …/reactions/{emoji}` (Trail #12), Keyset/`?since=`-Pagination | **committetes Frontend gewinnt** (M4-Prinzip): `POST /conversations/direct {user_id}→{id}`; verschachtelte `…/conversations/{id}/messages/{messageId}` (DELETE→Tombstone-Message); **POST-Toggle** `…/reactions {emoji}→Message`; volle `Message[]`-Liste (Keyset/Delta deferred); Notif-Read→`Notification[]`; Typ `new_message`. Realtime via **Polling + ETag/304** (kein Delta-Merge). | `frontend/src/api/chat.ts`+`notifications.ts`; M5-Plan |

---

### Offene Detail-Punkte (inline markiert, vor Migration zu klären)
- **§4 Spots:** Nutzer-eigene Spots (`POST /spots`) vs. nur Admin-Pflege (ADR-007).
- ~~**§11 Notifications:** finaler `type`-Schlüsselsatz.~~ → festgelegt = Frontend-Enum (§11, M5).
- **§12 Uploads:** Webspace-Schreibrechte/Quota für `public/media/uploads/`.
- **Querschnitt (DATA_MODEL):** `users.id`-Typ (Shield `INT UNSIGNED` vs. einheitliches `BIGINT`) betrifft jeden user-FK — blockierend für die Migrationsphase, aber außerhalb der API-Oberfläche.

---

Die Datei `API.md` ist als reiner Markdown-Inhalt oben vollständig konsolidiert. Zentrale Konsolidierungs-Entscheidungen: einheitlicher `/api/v1`-Präfix, **Shield-Session-Cookie statt Bearer/JWT** (ADR-004), **Polling statt Realtime-Dienst** (kein `/realtime/auth`, ADR-001), **eine polymorphe Chat-Engine** (Channel = Conversation, Messages unter `/conversations/{id}/messages`, ADR-005), **getrennte Beitritts-/Einladungs-Pfade** und **`visibility`+`join_policy`** (ADR-006), **berechneter Meetup-Status** `open|cancelled` persistiert (ADR-002), vereinheitlichte Enums (`beginner|advanced|expert`), sowie Reaktionen/Soft-Edit/Delete im MVP (ADR-009). Alle 16 aufgelösten Widersprüche sind im Audit-Trail (§13) dokumentiert; die zuvor offenen Detailpunkte sind durch **ADR-012** entschieden (u.a. `spots` nur Admin, `notifications.type`-Satz, Feed-Reaktionen).
