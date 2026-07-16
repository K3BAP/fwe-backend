# Auth & Profile

Dieses Kapitel spezifiziert Registrierung, Login/Logout, Session-Handling, Plattform-Rollen, das Profil-Schema (`users` via Shield + eigenes `profiles`), die Profilseite, die querschnittliche **Profilkarte** (Hovercard/Popover) inkl. „Direktchat öffnen", Avatar-Upload, Bio-Rendering/Sanitizing sowie Konto-Löschung. Bindend zugrunde liegen **ADR-004** (Shield + Session-Cookie), **ADR-010** (Profil „Erweitert"), **ADR-011** (Bio = eingeschränktes Markdown + doppeltes Sanitizing), **ADR-008** (deferred E-Mail-Flows), **ADR-002** (kein Cron, SQL-Dump-Deploy) und **ADR-005** (Direktchat = find-or-create DM über die polymorphe Chat-Engine).

> **Konvention:** Nutzersichtbare Labels Deutsch; technische Keys/DB-Spalten/API-Felder/`error.code` Englisch. Datum/Zeit im Frontend über `Intl` (`de-DE`). Realtime = Polling. Autorisierung serverseitig pro Objekt (BOLA-Schutz) **zusätzlich** zum Auth-Filter.

---

## 1. Architektur-Überblick

```
Browser (React 19 SPA, same-origin)
  │  fetch(credentials:'include')  +  X-CSRF-TOKEN Header
  ▼
CI4 /api/v1  ── csrf-Filter ── session(Shield)-Filter ──> Controller
                                                  │  BOLA-Check pro Objekt
                                                  ▼
                                          MySQL db_team15
                              (Shield: users, auth_identities, auth_groups_users …)
                              (eigen:  profiles, notifications, conversations …)
```

**Kernentscheidungen (aus ADR-004):**

- **Ein** Auth-Stack: CodeIgniter **Shield**, CI4+MySQL ist alleinige Identitäts-/Autorisierungsquelle. Kein Supabase, **kein** opaque Bearer-Token, **keine** eigene `auth_tokens`-Tabelle (der Vorschlag aus dem Dossier ist durch ADR-004 verworfen — Shield bringt `auth_identities`/Session selbst mit).
- **Session-Authenticator** mit **HttpOnly**-Cookie (`SameSite=Lax`), per JS nicht auslesbar → XSS-resistent gegen Token-Diebstahl.
- SPA wird **same-origin** von CI4 ausgeliefert → Cookies funktionieren nativ; `fetch` sendet sie via `credentials: 'include'`.
- **CSRF** über CI4-`csrf`-Filter (Double-Submit-Cookie + Request-Header für die SPA).
- React-Route-Guards sind **nur UX**; verbindlich ist der serverseitige `session`-Filter **plus** Objekt-Autorisierung.

> **✅ Entschieden (ADR-012/A1):** `users.id` wird durchgängig **`BIGINT UNSIGNED`**. Die Shield-`users`-Migration wird entsprechend überschrieben (Spaltentyp → `BIGINT UNSIGNED`), **bevor** abhängige Tabellen (`profiles.user_id` etc.) ihre FKs setzen. Damit ist das gesamte Schema einheitlich BIGINT.

---

## 2. Datenmodell

### 2.1 Shield-Tabellen (nicht neu erfinden)

Shield liefert per Migration u.a.:

| Tabelle | Zweck (Auth-relevant) |
|---|---|
| `users` | Identität. Spalten u.a. `id`, `username` (nullable, hier ungenutzt), `status`, `status_message`, `active`, `last_active`, `deleted_at`, `created_at`, `updated_at`. **Soft-Delete bereits eingebaut.** |
| `auth_identities` | Trägt das Login-Credential: `type='email_password'`, `secret`=E-Mail, `secret2`=`password_hash`. Hier liegt die E-Mail + der Passwort-Hash — **nicht** in `users`. |
| `auth_logins` | Login-Audit (Erfolg/Fehlschlag, IP, User-Agent). |
| `auth_remember_tokens` | „Angemeldet bleiben" (optional). |
| `auth_groups_users` | Mapping User ↔ Shield-Group → **Plattform-Rolle** (siehe §4). |
| `auth_permissions_users` | Direkte Permissions (im MVP ungenutzt). |
| `auth_token_logins` | Nur für Access-Token-Authenticator — **im MVP ungenutzt** (wir nutzen Session). |

> Die im Auth-Dossier vorgeschlagenen Spalten `users.email`, `users.password_hash`, `users.role` existieren in diesem Modell **nicht** als eigene Spalten: E-Mail/Passwort leben in `auth_identities`, die Rolle in `auth_groups_users`. Das ist durch ADR-004 so festgelegt.

**Deferred (Schema vorbereiten, ADR-008):** `email_verified_at` als Zusatzspalte auf `users` (nullable) **und/oder** Shield-`email_activate`-Action später aktivierbar; `password_resets`-Tabelle (`id, user_id FK, token_hash UNIQUE, expires_at, used_at NULL, created_at`) wird im Migrationsstand **angelegt aber ungenutzt** gelassen — kein SMTP im MVP (ADR-002).

### 2.2 `profiles` (eigene Tabelle, 1:1 zu `users`)

| Spalte | Typ | Null | Default | Beschreibung |
|---|---|---|---|---|
| `user_id` | `BIGINT UNSIGNED` | nein | — | **PK + FK** → `users.id` (`ON DELETE CASCADE`) |
| `display_name` | `VARCHAR(60)` | nein | — | Anzeigename (Pflicht bei Registrierung) |
| `handle` | `VARCHAR(30)` | ja | NULL | Eindeutiger @-Name, `UNIQUE`, Regex `^[a-z0-9_]{3,30}$`, lowercase |
| `bio_markdown` | `TEXT` | ja | NULL | Bio-Rohtext (eingeschränktes Markdown), max. 2000 Zeichen |
| `avatar_path` | `VARCHAR(255)` | ja | NULL | Relativer Pfad unter `public/media/uploads/avatars/…`; NULL ⇒ Default-Avatar |
| `experience_level` | `ENUM('beginner','advanced','expert')` | ja | NULL | Gleiche Skala wie Flugtreffen (konsolidiert; `all` gibt es nur auf `meetups`, nicht im Profil) |
| `license_class` | `VARCHAR(60)` | ja | NULL | Schein/Lizenz als **Freitext** (ADR-012/C1; nationale Klassen variieren), z.B. „A-Schein", „B-Schein" |
| `glider` | `VARCHAR(80)` | ja | NULL | Marke/Modell, Freitext |
| `home_region` | `VARCHAR(80)` | ja | NULL | Heimatregion, Freitext (nicht zwingend an `spots.region` gebunden) |
| `flight_hours` | `INT UNSIGNED` | ja | NULL | Geschätzte Flugstunden |
| `created_at` | `DATETIME` | nein | — | |
| `updated_at` | `DATETIME` | nein | — | |

**Begründung Trennung `users`/`profiles`:** Auth-Identität (Shield) bleibt unangetastet/upgradebar; Anzeige-/Pilotendaten sind frei erweiterbar. **Alle** Pilotenfelder sind nullable (ADR-010): Registrierung verlangt nur `display_name`; Bild/Bio/Pilotdaten werden im Profil-Setup nachgereicht.

`experience_level`-Enum-Mapping (deutsche Labels für UI):

| key | Label (de) |
|---|---|
| `beginner` | Anfänger |
| `advanced` | Fortgeschritten |
| `expert` | Profi |

---

## 3. Auth-Flows

### 3.1 CSRF-Bootstrapping der SPA

CI4-`csrf`-Filter ist für alle nicht-idempotenten `/api/v1`-Routen aktiv (`POST/PUT/PATCH/DELETE`). Konfiguration: `Config\Security` mit `tokenRandomize=true`, Cookie-Name z.B. `csrf_cookie`, Header-Name `X-CSRF-TOKEN`, `regenerate=true`, `csrfProtection='cookie'`.

Ablauf:

1. Beim App-Start ruft die SPA einmal `GET /api/v1/auth/csrf` (idempotent, kein CSRF nötig) → Server setzt das CSRF-Cookie (lesbar per JS, **nicht** HttpOnly) und liefert `{ "csrfToken": "<wert>" }`.
2. Der zentrale `fetch`-Client liest das Token (aus Response **oder** Cookie) und sendet es bei jedem schreibenden Request als `X-CSRF-TOKEN`-Header **plus** `credentials: 'include'`.
3. Bei `403 csrf_invalid` (Token rotiert) holt der Client das Token neu und wiederholt den Request **einmal**.

> Das **Session-Cookie** ist HttpOnly (Diebstahlschutz). Das **CSRF-Cookie** ist bewusst JS-lesbar (Double-Submit). Beide Mechanismen sind getrennt.

### 3.2 Registrierung — `POST /api/v1/auth/register`

Legt Shield-`users` + `auth_identities` (email_password) + `profiles`-Zeile **in einer Transaktion** an, fügt den User der Group `user` hinzu und loggt ihn direkt ein (Session-Start), da im MVP keine E-Mail-Verifikation aktiv ist (ADR-008).

Request:
```json
{
  "email": "pilot@example.com",
  "password": "supersecret123",
  "password_confirm": "supersecret123",
  "display_name": "Lena Thermik"
}
```

Validierung (serverseitig, Quelle der Wahrheit):

| Feld | Regel | error.code bei Verstoß |
|---|---|---|
| `email` | gültige E-Mail, `UNIQUE` über `auth_identities.secret` | `email_taken` / `email_invalid` |
| `password` | min. 8 Zeichen, Shield-`MinimumLength`+`NothingPersonal`+`PwnedValidator`(optional offline aus) | `password_weak` |
| `password_confirm` | identisch zu `password` | `password_mismatch` |
| `display_name` | 2–60 Zeichen, trim, nicht leer | `display_name_invalid` |

Erfolg `201`:
```json
{
  "data": {
    "user": {
      "id": 42,
      "display_name": "Lena Thermik",
      "handle": null,
      "avatar_url": "/media/avatars/default/42.svg",
      "role": "user"
    }
  }
}
```
Begleitend setzt der Server das HttpOnly-Session-Cookie. Die SPA ruft danach `GET /auth/me` (oder nutzt direkt die Response) und navigiert ins Dashboard.

Fehlerantwort (einheitliches Envelope):
```json
{ "error": { "code": "email_taken", "message": "Diese E-Mail-Adresse ist bereits registriert." } }
```

### 3.3 Login — `POST /api/v1/auth/login`

```json
{ "email": "pilot@example.com", "password": "supersecret123", "remember": false }
```

- Shield-`SessionAuthenticator->attempt()`. Erfolg ⇒ Session-Cookie wird gesetzt; `200` mit demselben `user`-Objekt wie bei Register.
- Fehlschlag ⇒ **einheitlich** `401 invalid_credentials` (E-Mail/Passwort nicht unterscheiden → keine User-Enumeration). Deutsche Message: „E-Mail oder Passwort ist falsch."
- Rate-Limiting: Shield-`auth_logins` + CI4-`throttler` (z.B. 5 Fehlversuche/Minute pro IP+E-Mail) ⇒ `429 rate_limited`.
- `remember=true` ⇒ `auth_remember_tokens` (Langzeit-Cookie). Default `false`.

### 3.4 Logout — `POST /api/v1/auth/logout`

Beendet die Shield-Session (`logout()`), invalidiert Remember-Token, löscht Session-Cookie. Antwort `204`. Idempotent (auch ohne aktive Session `204`).

### 3.5 Session-Bootstrap — `GET /api/v1/auth/me`

Liefert den eingeloggten Nutzer + **eigenes** Profil. Treibt das Auth-Gate der SPA (Landing vs. Dashboard) und den Zustand-Store.

`200`:
```json
{
  "data": {
    "user": { "id": 42, "role": "user", "email": "pilot@example.com" },
    "profile": {
      "user_id": 42,
      "display_name": "Lena Thermik",
      "handle": "lena_t",
      "bio_markdown": "**XC-Pilotin** aus der Eifel.",
      "avatar_url": "/media/uploads/avatars/ab12cd….webp",
      "experience_level": "advanced",
      "license_class": "B-Schein",
      "glider": "Ozone Rush 6",
      "home_region": "Eifel",
      "flight_hours": 320,
      "created_at": "2026-05-01T10:00:00+02:00",
      "updated_at": "2026-06-18T18:30:00+02:00"
    }
  }
}
```
Ohne gültige Session ⇒ `401 unauthenticated` (die SPA rendert dann Landing/Login, **kein** Redirect-Loop).

> `email` wird **nur** in `me`-Responses zurückgegeben, **nie** in öffentlichen Profil-/Profilkarten-Responses.

### 3.6 Deferred E-Mail-Flows (Schema vorbereitet, nicht aktiv)

`POST /auth/password/forgot`, `POST /auth/password/reset`, `GET /auth/verify-email` sind **spezifiziert, aber nicht implementiert** (ADR-002/008, keine verlässliche SMTP). Es gibt **keine** Routen dafür — auch keine 501-Stubs; Auto-Routing ist aus, unbekannte Pfade antworten `404`. Vom vorbereiteten Schema existiert `profiles.email_verified_at`; eine `password_resets`-Tabelle wurde nicht angelegt. Dieser Abschnitt dokumentiert den späteren Ausbaupfad.

---

## 4. Plattform-Rollen (Shield-Groups)

Genau zwei globale Rollen über **Shield-Groups** (nicht über eine `users.role`-Spalte):

| Group | Bedeutung | Vergabe |
|---|---|---|
| `user` | Standard. Bei Registrierung automatisch zugewiesen (`Config\AuthGroups::$defaultGroup = 'user'`). | automatisch |
| `admin` | Basis-Moderation: Nutzer sperren/entsperren, Inhalte (Soft-)löschen. | manuell per Seed/SQL |

- Autorisierung im Controller: `auth()->user()->inGroup('admin')`.
- **Gruppen-/Community-Rollen** (Owner/Mitglied einer Gruppe) sind **eine separate Domäne** (`group_members.role`) und gehören **nicht** in die Plattform-Rolle.
- Admin-Endpunkte sind durch einen zusätzlichen `group:admin`-Filter geschützt (siehe §5).

Admin-Endpunkte (Verwaltung, ADR-019 — Details in API.md §11b):

`PATCH /admin/users/{id}` (Profilfelder), `POST …/admin` (`{is_admin}` via `addGroup`/`removeGroup`), `POST …/active` (`{active}` — Sperre), `DELETE`/`POST …/restore` (Shield-Soft-Delete). Nur `admin`. Selbstschutz je Aktion: `409 admin_self_demote|admin_self_deactivate|admin_self_delete`.

---

## 5. Autorisierung: Guards vs. Filter (BOLA-Schutz)

**Zwei Ebenen, beide verbindlich:**

1. **Frontend-Route-Guards (nur UX):** React-Router `<ProtectedRoute>` liest den Auth-Store (gespeist aus `GET /auth/me`). Verhindert nur das _Anzeigen_ geschützter Views und vermeidet Flackern. **Keine Sicherheitsgrenze.**
2. **Serverseitig (Sicherheitsgrenze):**
   - **Auth-Filter:** Shield-`session`-Filter als `before`-Filter auf der gesamten `/api/v1`-Gruppe (außer `auth/csrf`, `auth/login`, `auth/register`, öffentliche GETs). Ohne Session ⇒ `401`.
   - **Objekt-Autorisierung (BOLA):** zentraler Helper im `BaseApiController` (z.B. `authorizeOwner($resourceUserId)`, `authorizeMember($groupId)`), aufgerufen **in jeder Aktion**. Beispiel: `PATCH /me/profile` darf nur das eigene Profil ändern; `PATCH /admin/users/{id}` nur mit `admin`-Group. Verstoß ⇒ `403 forbidden` (nicht `404`, außer Existenz soll verborgen werden).
   - **Admin-Filter:** `group:admin` als zusätzlicher `before`-Filter auf `/api/v1/admin/*`.

> **Profil-Sichtbarkeit (ADR-012/B1+C2):** Öffentliche Profile sind **ohne Login lesbar**, aber **reduziert** — Gäste sehen `display_name`, `@handle`, `avatar_url`, `bio_markdown`, `experience_level`. Die Zusatzfelder (`home_region`, `glider`, `license_class`, `flight_hours`) liefert der Server **nur an eingeloggte** Nutzer. E-Mail nie öffentlich. `GET /users/{id}` ist damit ein **öffentlicher** Endpoint mit auth-abhängiger Feldprojektion.

---

## 6. Profil-Endpunkte

| Methode | Pfad | Auth | Zweck |
|---|---|---|---|
| `GET` | `/api/v1/auth/me` | session | Eigener User + vollständiges Profil (§3.5) |
| `GET` | `/api/v1/me/profile` | session | Eigenes editierbares Profil (Alias-Detailsicht) |
| `PATCH` | `/api/v1/me/profile` | session + owner | Profil aktualisieren |
| `POST` | `/api/v1/me/avatar` | session + owner | Avatar hochladen (multipart) |
| `DELETE` | `/api/v1/me/avatar` | session + owner | Avatar entfernen → Default |
| `DELETE` | `/api/v1/me` | session + owner | Konto-Löschung (Soft-Delete/Anonymisierung, §9) |
| `GET` | `/api/v1/users/{id}` | **öffentlich** | Öffentliches Profil (Profilkarte/Profilseite); reduziert für Gäste, Zusatzfelder nur eingeloggt; **ohne** E-Mail |
| `GET` | `/api/v1/users` | session | Nutzer suchen/auflisten (paginiert; für Einladungen/@-Suche) |
| `GET` | `/api/v1/users/handle/{handle}` | — | **deferred** (keine Route; Handle-Suche läuft über `GET /users?q=`) |
| `PATCH`/`POST`/`DELETE` | `/api/v1/admin/users/{id}[…]` | admin | Verwaltung: Profil/Rolle/Sperre/Soft-Delete (ADR-019, API.md §11b) |
| `POST` | `/api/v1/conversations/direct` | session | **Direktchat find-or-create** (Querschnitt, §8) |

### 6.1 `PATCH /api/v1/me/profile`

Partielles Update. Alle Felder optional; nur gesendete werden geändert.

```json
{
  "display_name": "Lena T.",
  "handle": "lena_t",
  "bio_markdown": "## Über mich\n**XC-Pilotin** aus der *Eifel*.",
  "experience_level": "advanced",
  "license_class": "B-Schein",
  "glider": "Ozone Rush 6",
  "home_region": "Eifel",
  "flight_hours": 320
}
```

Validierung (Auszug). Regelverstöße antworten einheitlich `422 validation_error` mit einer
`fields`-Map (Feld → deutsche Meldung); nur die Handle-Kollision ist ein eigener `409 handle_taken`:

| Feld | Regel |
|---|---|
| `handle` | `^[a-z0-9_]{3,30}$`, `UNIQUE`, lowercase-normalisiert (Kollision ⇒ `409 handle_taken`) |
| `bio_markdown` | max. 2000 Zeichen; Rendering client-seitig eingeschränkt (§7) |
| `experience_level` | ∈ Enum |
| `flight_hours` | `>= 0`, Integer |
| `display_name` | 2–80 Zeichen |

Erfolg `200` ⇒ aktualisiertes Profil-Objekt (wie `me.profile`). TanStack Query invalidiert `['me']` und `['user', id]`.

### 6.2 `GET /api/v1/users/{id}` — öffentliche Profil-Projektion

Reduziertes, sicheres DTO (kein `email`, kein interner Status):

```json
{
  "data": {
    "id": 42,
    "display_name": "Lena Thermik",
    "handle": "lena_t",
    "avatar_url": "/media/uploads/avatars/ab12cd….webp",
    "bio_markdown": "**XC-Pilotin** aus der Eifel.",
    "experience_level": "advanced",
    "license_class": "B-Schein",
    "glider": "Ozone Rush 6",
    "home_region": "Eifel",
    "flight_hours": 320,
    "is_self": false,
    "is_deleted": false
  }
}
```

Bei gelöschtem/anonymisiertem Konto (§9): `display_name="Gelöschter Nutzer"`, `avatar_url`=Default, alle Pilotenfelder/`bio_markdown`=null, `is_deleted=true`. Kein `404`, damit Referenzen in Chats/Gruppen integer bleiben.

> **Feldprojektion (ADR-012/C2):** Für **nicht eingeloggte** Anfragen werden `home_region`, `glider`, `license_class`, `flight_hours` weggelassen (bzw. `null`); **eingeloggte** Nutzer erhalten den vollen Satz oben. `email`/interner Status nie.

### 6.3 `GET /api/v1/users` — Suche/Liste

Query: `?q=lena&experience_level=advanced&page=1&per_page=20`. Antwort: paginierte Liste der öffentlichen Profil-Projektion (§6.2) + `meta.pagination`. Nutzbar für Gruppen-Einladungen und @-Erwähnungen.

---

## 7. Bio: eingeschränktes Markdown + doppeltes Sanitizing (ADR-011)

**Erlaubt:** Fett, Kursiv, Listen (ul/ol), Links, Überschriften (h1–h3). **Verboten:** rohes HTML, Bilder, Skripte, iframes, beliebige Attribute.

**Speicherung (Server):** Rohtext (`bio_markdown`) wird gespeichert, **aber** vorher längenbegrenzt (≤2000) und durch einen serverseitigen Sanitizer geführt, der gefährliche Konstrukte neutralisiert (z.B. `javascript:`-URLs, eingebettetes HTML). Server vertraut dem Client **nicht**.

**Rendering (Client) — Schicht 2:** `react-markdown` **ohne** `rehype-raw` (kein rohes HTML wird interpretiert) + Tag-/Attribut-Allowlist via `rehype-sanitize` (custom Schema: nur `a,strong,em,ul,ol,li,h1,h2,h3,p,br`; `a` nur mit `href` http/https/mailto, erzwingt `rel="noopener noreferrer nofollow"`, `target="_blank"`).

> **Doppeltes Sanitizing ist nicht verhandelbar** und gilt **überall**, wo die Bio gerendert wird — insbesondere in der querschnittlichen **Profilkarte** (§8), die an vielen Stellen eingebunden ist. Eine einzige `<BioMarkdown source={…} />`-Komponente kapselt das Rendering, damit keine Render-Stelle das Sanitizing umgehen kann.

---

## 8. Querschnittskomponente: Profilkarte (Hovercard / Popover)

Eine **einzige** wiederverwendbare `<UserCard userId>` / `<UserHoverCard>`-Komponente, überall dort eingebunden, wo ein Nutzer erscheint (Chat-Nachrichten, Teilnehmerlisten, Gruppen-Mitglieder, Feed). Verhindert N-fache Reimplementierung und zentralisiert Sanitizing + „Direktchat".

**Verhalten:**

- Datenquelle: TanStack Query, **pro `userId` gecacht** (`['user', id]`, `staleTime` ~5 min) → Hover über mehrere Nachrichten desselben Nutzers löst nur **eine** Abfrage aus.
- Trigger: Hover (Desktop, Verzögerung ~300 ms) bzw. Tap/Klick (Touch) auf Avatar/Name → Popover (Framer Motion Ein-/Ausblendung, fokus-fallenfrei, schließt bei Escape/Outside-Click).
- Inhalt (reduzierter Satz, ADR-010): Avatar, `display_name`, `@handle`, `experience_level`-Badge (deutsches Label), `home_region`, gekürzte Bio (gerendert über `<BioMarkdown>`), Buttons **„Profil ansehen"** (→ `/u/{handle|id}`) und **„Direktchat öffnen"**.
- **Kein** `email`-Feld, **kein** Pilotenfeld, das in der vollen Profilseite, aber nicht in der Karte gewünscht ist (Karte = bewusst reduziert).
- Eigener Nutzer (`is_self=true`): „Direktchat öffnen" wird ausgeblendet; stattdessen „Profil bearbeiten".

**„Direktchat öffnen" (find-or-create DM, ADR-005):**

```
POST /api/v1/conversations/direct
{ "target_user_id": 99 }
```
Server berechnet deterministischen `dm_key` (z.B. `min(a,b):max(a,b)`), `UNIQUE` ⇒ find-or-create in Transaktion (Race-sicher). Antwort `200` (bestehend) bzw. `201` (neu):
```json
{ "data": { "conversation": { "id": 7, "type": "direct" } } }
```
Frontend navigiert nach `/chat/7`. Selbst-DM verboten (`409 cannot_dm_self`). Gegenüber gelöscht ⇒ `409 user_unavailable`.

> Detail-Spezifikation der Chat-Engine selbst liegt im Chat-Kapitel; hier wird **nur der Trigger** + der `/conversations/direct`-Vertrag festgehalten, weil die Profilkarte ihn auslöst.

---

## 9. Avatar-Upload

**Speicherort:** `public/media/uploads/avatars/` — bewusst **außerhalb** des Vite-Build-Outputs (Querschnitt-Konsens: `public/` wird vom Build berührt, daher separates `media/uploads/`, das im `.deployignore`/Build unangetastet bleibt). `writable/` ist **nicht** public und daher ungeeignet für direkt ausgelieferte Bilder.

**`POST /api/v1/me/avatar` (multipart, Feld `file`):**

Serverseitige Pipeline (verbindlich):

1. **MIME-Whitelist:** nur `image/jpeg`, `image/png`, `image/webp` — geprüft per echtem Content-Sniffing (`finfo`), **nicht** nur per Dateiendung/Client-Header. Sonst `415 unsupported_media_type`.
2. **Größenlimit:** max. 5 MB → sonst `413 file_too_large`.
3. **Bildvalidierung:** muss dekodierbares Bild sein (GD) → sonst `422 invalid_image`.
4. **EXIF-Strip:** Metadaten (inkl. GPS) entfernen → re-encoden via GD (Decode→Encode strippt EXIF implizit).
5. **Resize/Normalisieren:** quadratischer Center-Crop, Ausgabe **512×512** (Hauptbild) + **128×128** (Thumbnail), Re-Encode als **WebP** (oder PNG-Fallback).
6. **Randomisierter Dateiname:** kryptografisch zufällig (z.B. `bin2hex(random_bytes(16))`), keine vom Nutzer kontrollierten Namen → kein Path-Traversal, kein Overwrite.
7. `avatar_path` in `profiles` setzen; **altes** Avatar-File löschen.

Antwort `200`:
```json
{ "data": { "avatar_url": "/media/uploads/avatars/ab12cd….webp", "thumb_url": "/media/uploads/avatars/ab12cd…_thumb.webp" } }
```

**Client:** optionaler Crop vor Upload (z.B. `react-easy-crop`) — UX, **keine** Sicherheitsgrenze; die Serverpipeline läuft unabhängig.

**`DELETE /api/v1/me/avatar`:** löscht Files, setzt `avatar_path=NULL` → `200` mit Default-`avatar_url`.

**Default-Avatare:** deterministisch aus `user_id`/Initialen generiert (Initialen-SVG oder Gleitschirm-Icon), serverseitig stabile URL (`/media/avatars/default/{id}.svg`) oder clientseitig gerendert. Kein Upload nötig, Profil ist sofort vollständig nutzbar.

> ⚠️ Schreibrechte/Quota des Upload-Verzeichnisses **früh auf dem echten Uni-Webspace** testen (ADR-002).

---

## 10. Konto-Löschung (Soft-Delete / Anonymisierung, DSGVO-light)

> **Stand der Umsetzung:** `DELETE /me` (Selbst-Löschung inkl. Anonymisierung) ist **nicht
> implementiert.** Konto-Löschung gibt es im MVP nur als **Admin-Soft-Delete** (ADR-019: reversibel,
> ohne Anonymisierung; Inhalte und Profil bleiben). Der folgende Entwurf bleibt als Ausbaupfad
> dokumentiert.

**Entscheidung:** Soft-Delete + Anonymisierung über Shields `users.deleted_at` (vorhanden) **plus** Profil-Anonymisierung. **Kein** Hard-Delete (Kaskadenrisiko in Chats/Gruppen/Feeds).

**`DELETE /api/v1/me` (eigenes Konto):**

In einer Transaktion:

1. `users.deleted_at = now()`, Account deaktivieren (`active=0`), Sessions/Remember-Tokens invalidieren, Logout.
2. `auth_identities` (E-Mail+Passwort-Hash) **löschen oder anonymisieren** → kein Login mehr, E-Mail wird wieder frei/entkoppelt.
3. `profiles`: `display_name="Gelöschter Nutzer"`, `bio_markdown=NULL`, alle Pilotenfelder `NULL`, `handle=NULL` (gibt Handle frei), `avatar_path=NULL` → Avatar-Files physisch löschen.
4. Inhalte (Nachrichten, Feed-Posts, Mitgliedschaften) bleiben referenziell intakt; UI zeigt sie als von „Gelöschter Nutzer" (über die `is_deleted`-Projektion §6.2).

Antwort `204`; Session-Cookie wird gelöscht.

**Admin-Sperre** (`POST /admin/users/{id}/active`, ADR-019) ist davon getrennt: sie setzt nur `active=0` (der `ApiAuthFilter` beendet die laufende Session beim nächsten Request), **ohne** Anonymisierung — reversibel.

> **✅ Entschieden (ADR-012/C4):** `groups.owner_user_id` ist `ON DELETE RESTRICT`; vor einer echten Konto-Löschung erzwingt der Service einen **Owner-Transfer** (keine verwaisten Gruppen). Konto-„Löschen" ist ohnehin primär Soft-Delete.

---

## 11. Akzeptanzkriterien

**Auth/Session**
- [ ] Registrierung legt `users` + `auth_identities` + `profiles` + Group `user` **atomar** an; doppelte E-Mail ⇒ `409 email_taken`.
- [ ] Nach Register/Login ist ein **HttpOnly**-Session-Cookie gesetzt (per `document.cookie` **nicht** lesbar).
- [ ] `GET /auth/me` liefert ohne Session `401`, mit Session User+Profil inkl. `email` (nur hier).
- [ ] Login mit falscher E-Mail **und** falschem Passwort liefert identisch `401 invalid_credentials` (keine Enumeration).
- [ ] Schreibende Requests ohne gültiges `X-CSRF-TOKEN` ⇒ `403`; nach Token-Refresh+Retry erfolgreich.
- [ ] `> 5` Fehllogins/min ⇒ `429 rate_limited`.
- [ ] Logout ist idempotent (`204` auch ohne Session) und invalidiert Remember-Token.

**Autorisierung (BOLA)**
- [ ] `PATCH /me/profile` eines fremden Profils ist **nicht möglich** (Endpoint operiert immer auf `auth()->id()`).
- [ ] `/api/v1/admin/*` ohne `admin`-Group ⇒ `403 forbidden`; Frontend-Guard allein verhindert es **nicht** (per direktem API-Call getestet).
- [ ] `GET /users/{id}` ohne Session ⇒ `200` mit **reduzierter** Projektion (ADR-012/B1+C2); enthält **nie** `email`/`status`; Zusatzfelder (`home_region`/`glider`/`license_class`/`flight_hours`) nur bei eingeloggter Anfrage.

**Profil & Bio**
- [ ] `handle` ist `UNIQUE`, lowercase-normalisiert; Kollision ⇒ `409 handle_taken`.
- [ ] Bio mit eingebettetem `<script>`/`<img onerror=…>`/`javascript:`-Link wird **server- und clientseitig** neutralisiert (XSS-Test grün in der Profilkarte **und** Profilseite).
- [ ] Bio > 2000 Zeichen ⇒ `422 validation_error` (fields.bio_markdown).

**Avatar**
- [ ] Upload einer `.png`-Datei mit gefälschtem `image/jpeg`-Header wird per Content-Sniffing erkannt und korrekt verarbeitet/abgelehnt.
- [ ] Non-Image (z.B. umbenannte `.exe`) ⇒ `415`/`422`; Datei > 5 MB ⇒ `413`.
- [ ] Ausgabe ist 512×512 (+128er Thumb), **WebP**, **ohne EXIF/GPS**, mit randomisiertem Namen; altes File wird gelöscht.
- [ ] Profil ohne Avatar zeigt deterministischen Default-Avatar (Initialen/Icon).

**Profilkarte (Querschnitt)**
- [ ] Hover über 5 Nachrichten desselben Nutzers löst **eine** API-Abfrage aus (Cache pro `userId`).
- [ ] „Direktchat öffnen" ruft `POST /conversations/direct` (find-or-create) auf und navigiert zur Konversation; zweiter Aufruf liefert **dieselbe** Konversation (`dm_key`-UNIQUE).
- [ ] Bei `is_self=true` zeigt die Karte „Profil bearbeiten" statt „Direktchat öffnen".

**Konto-Löschung** *(deferred — nicht implementiert, s. §10; im MVP nur Admin-Soft-Delete, ADR-019)*
- [ ] `DELETE /me` anonymisiert `profiles`, entfernt Login-Credential, löscht Avatar-Files, setzt `deleted_at`; danach kein Login mehr möglich.
- [ ] Vom gelöschten Nutzer verfasste Chat-Nachrichten/Feed-Posts bleiben sichtbar als „Gelöschter Nutzer" (kein `404`, keine Broken-Refs).

**Deferred (spezifiziert, ohne Routen — s. §3.6)**
- [ ] `password/forgot|reset`, `verify-email`: kein Endpunkt im MVP (`404`); nur `profiles.email_verified_at` ist als Schema-Vorbereitung angelegt.

---

## 12. Relevante API-Endpunkte (Übersicht)

| Methode | Pfad | Auth | Status |
|---|---|---|---|
| GET | `/api/v1/auth/csrf` | – | aktiv |
| POST | `/api/v1/auth/register` | – | aktiv |
| POST | `/api/v1/auth/login` | – | aktiv |
| POST | `/api/v1/auth/logout` | session | aktiv |
| GET | `/api/v1/auth/me` | session | aktiv |
| POST | `/api/v1/auth/password/forgot` | – | **deferred** (keine Route, §3.6) |
| POST | `/api/v1/auth/password/reset` | – | **deferred** (keine Route, §3.6) |
| GET | `/api/v1/auth/verify-email` | – | **deferred** (keine Route, §3.6) |
| GET | `/api/v1/me/profile` | session | aktiv |
| PATCH | `/api/v1/me/profile` | session+owner | aktiv |
| POST | `/api/v1/me/avatar` | session+owner | aktiv |
| DELETE | `/api/v1/me/avatar` | session+owner | aktiv |
| DELETE | `/api/v1/me` | session+owner | **deferred** (§10; nur Admin-Soft-Delete, ADR-019) |
| GET | `/api/v1/users/{id}` | **öffentlich** (reduziert) | aktiv |
| GET | `/api/v1/users/handle/{handle}` | session | **deferred** (keine Route; Suche via `GET /users?q=`) |
| GET | `/api/v1/users` | session | aktiv |
| POST | `/api/v1/conversations/direct` | session | aktiv (Querschnitt Chat) |
| PATCH/POST/DELETE | `/api/v1/admin/users/{id}[…]` | admin | aktiv (ADR-019, API.md §11b) |

**Einheitliches Response-Envelope:** Erfolg `{ "data": … , "meta"?: … }`; Fehler `{ "error": { "code": "<english_snake_case>", "message": "<deutsch>" } }`. `error.code` ist die maschinenlesbare, stabile Kennung; `error.message` der deutsche Anzeigetext.
