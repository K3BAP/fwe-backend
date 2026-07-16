# Backend-Architektur, API-Konventionen & Deployment

> **Scope dieses Kapitels:** Konventionen, Schichten und Betriebsregeln der CodeIgniter-4-REST-API unter `/api/v1`, der Deploy-Workflow auf den geteilten Uni-Webspace sowie Test-, Performance- und Sicherheitsbudgets. Das **vollständige Tabellen-/Feld-Schema** ist NICHT hier, sondern in [`DATA_MODEL.md`](DATA_MODEL.md) definiert (Wahrheit für alle Spalten-/Enum-Namen). Architekturbegründungen siehe [`DECISIONS.md`](DECISIONS.md) (ADR-001…011).

---

## 1. Stack & Schichtenmodell

| Schicht | Technologie | Verantwortung |
|---|---|---|
| HTTP/Routing | CI4 `Routes.php`, `group('api/v1')` | Versionierte Routing-Gruppe, Filter-Bindung |
| Filter (Before/After) | CI4 Filters (`auth`, `csrf`, `throttle`) | Authentifizierung, CSRF, Rate-Limiting |
| Controller | `BaseApiController` + Domänen-Controller | Request→Validierung→Service→Envelope |
| Validierung | CI4 Validation (spiegelt Zod) | Eingabeprüfung, deutsche Messages |
| Domänen-/Service-Logik | eigene `App\Services\*` | Transaktionen, abgeleitete Zustände, BOLA |
| Persistenz | CI4 Models / Query Builder, **MySQL** | Source of Truth (ADR-001) |
| Auth-Identität | **CodeIgniter Shield** (Session) | Login, Groups, `auth()->user()` |
| Cache | **FileCache** (`writable/cache`) | wenige teure Reads, ETag-Support |
| Medien | `public/media/uploads/` | öffentliche Bilder, GD-Resize |

**Verbindlich (ADR-004):** CI4 + Shield ist die **alleinige** Auth-/Identitätsquelle. Kein zweiter Auth-Stack, kein Supabase, kein JWT (das im Dossier `backend-deploy.json` mehrfach genannte „JWT-Cookie" ist durch ADR-004 **überholt** → **Shield-Session-Cookie**, HttpOnly + SameSite).

**✅ Entschieden (ADR-012/A1):** `users.id` projektweit `BIGINT UNSIGNED` — eine Migration direkt nach Shield hebt den Typ an, bevor user-FKs gesetzt werden (DATA_MODEL.md §2/§10).

---

## 2. Routing: `/api/v1`-Gruppen

Alle API-Routen liegen unter `app/Config/Routes.php` in einer versionierten Gruppe. Die SPA wird same-origin aus `public/` ausgeliefert; **CORS wird bewusst NICHT konfiguriert** (Dev löst Cross-Port über den Vite-Proxy `/api`, `/media`).

```php
$routes->group('api/v1', ['namespace' => 'App\Controllers\Api\V1'], function ($routes) {

    // --- öffentlich (kein auth-Filter) ---
    $routes->group('auth', function ($routes) {
        $routes->post('register', 'AuthController::register');
        $routes->post('login',    'AuthController::login',  ['filter' => 'throttle:login']);
        $routes->post('logout',   'AuthController::logout', ['filter' => 'auth']);
        $routes->get('me',        'AuthController::me',     ['filter' => 'auth']);
    });
    $routes->get('spots',          'SpotController::index');          // cachebar, öffentlich
    $routes->get('users/(:num)',   'ProfileController::show/$1');      // öffentl. Profil (reduziert, ADR-012/B1+C2)

    // --- ab hier alles auth-pflichtig ---
    $routes->group('', ['filter' => 'auth'], function ($routes) {

        $routes->patch('profiles/me', 'ProfileController::updateMe');

        // Flugtreffen
        $routes->get('meetups',                 'MeetupController::index');
        $routes->post('meetups',                'MeetupController::create');
        $routes->get('meetups/(:num)',          'MeetupController::show/$1');
        $routes->patch('meetups/(:num)',        'MeetupController::update/$1');
        $routes->delete('meetups/(:num)',       'MeetupController::cancel/$1');   // status=cancelled (soft)
        $routes->post('meetups/(:num)/join',    'MeetupController::join/$1');
        $routes->delete('meetups/(:num)/join',  'MeetupController::leave/$1');

        // Gruppen
        $routes->get('groups',                       'GroupController::index');
        $routes->post('groups',                      'GroupController::create');
        $routes->get('groups/(:num)',                'GroupController::show/$1');
        $routes->patch('groups/(:num)',              'GroupController::update/$1');
        $routes->post('groups/(:num)/members',       'GroupMemberController::join/$1');     // join/request
        $routes->delete('groups/(:num)/members/(:num)','GroupMemberController::remove/$1/$2');
        $routes->post('groups/(:num)/invites',       'GroupInviteController::create/$1');
        $routes->get('groups/(:num)/requests',       'GroupRequestController::index/$1');
        $routes->patch('groups/(:num)/requests/(:num)','GroupRequestController::resolve/$1/$2');
        $routes->get('groups/(:num)/feed',           'FeedController::index/$1');
        $routes->post('groups/(:num)/feed',          'FeedController::create/$1');
        $routes->delete('feed/(:num)',               'FeedController::destroy/$1');         // soft-delete

        // Chat (polymorphe Engine, ADR-005)
        $routes->get('conversations',                       'ConversationController::index');
        $routes->post('conversations',                      'ConversationController::createDirect');
        $routes->get('conversations/(:num)/messages',       'MessageController::index/$1');
        $routes->post('conversations/(:num)/messages',      'MessageController::create/$1');
        $routes->patch('messages/(:num)',                   'MessageController::update/$1');   // soft-edit
        $routes->delete('messages/(:num)',                  'MessageController::destroy/$1');  // soft-delete
        $routes->put('messages/(:num)/reactions',           'ReactionController::toggle/$1');
        $routes->post('conversations/(:num)/read',          'ConversationController::markRead/$1');

        // Benachrichtigungen (ADR-008)
        $routes->get('notifications',            'NotificationController::index');
        $routes->get('notifications/unread-count','NotificationController::unreadCount'); // schlank fürs Polling
        $routes->post('notifications/read',      'NotificationController::markRead');

        // Uploads
        $routes->post('uploads', 'UploadController::store');   // ?context=avatar|group_logo|feed
    });
});
```

**Konventionen:**
- Sammel-Routen vor Detail-Routen; `(:num)` für IDs (kein `(:any)` → vermeidet Path-Injection).
- Nicht-CRUD-Aktionen (`join`, `leave`, `resolve`, `markRead`, `toggle`) als **explizite** Routen, nicht über ResourceController-Magie (ADR-Begründung §6).
- `auto-routing` ist **abgeschaltet** (`Routing::$autoRoutes = false`), nur definierte Routen existieren.

---

## 3. Response-Envelope & Statuscode-Katalog

Jede API-Antwort nutzt ein einheitliches Envelope. **Erfolg** trägt `data` (+ optional `meta`), **Fehler** trägt `error` mit **englischem `code`** (maschinenlesbar, stabil) + **deutscher `message`** (anzeigbar). Diese Trennung ist Querschnitts-Konvention (`_crosscutting.json`, ADR-Konvention).

### Erfolg

```json
{
  "data": { "id": 42, "title": "Frühflug Wasserkuppe", "status": "open" },
  "meta": { "page": 1, "perPage": 20, "total": 57 }
}
```
`meta` nur bei Listen/Pagination. Bei `204 No Content` kein Body.

### Fehler

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Bitte korrigiere die markierten Felder.",
    "fields": {
      "title":     "Titel ist erforderlich.",
      "starts_at": "Startzeit muss in der Zukunft liegen."
    }
  }
}
```
`fields` nur bei `422`. Es wird **nie** ein roher CI4-Stacktrace oder PHP-Fehler an den Client geleakt (`CI_ENVIRONMENT=production` + globaler Exception-Handler → `internal_error`).

### HTTP-Statuscode-Katalog (verbindlich)

| Code | Verwendung | `error.code` (Beispiel) |
|---|---|---|
| `200 OK` | erfolgreicher Read/Update mit Body | – |
| `201 Created` | Ressource erstellt (Meetup, Gruppe, Message) | – |
| `204 No Content` | Erfolg ohne Body (leave, markRead, delete) | – |
| `304 Not Modified` | ETag-Match (Polling) | – |
| `400 Bad Request` | malformter Request (kein JSON, falscher Typ) | `bad_request` |
| `401 Unauthorized` | nicht eingeloggt / Session ungültig | `unauthenticated` |
| `403 Forbidden` | eingeloggt, aber **nicht berechtigt** (BOLA) | `forbidden`, `not_a_member` |
| `404 Not Found` | Ressource existiert nicht / soft-deleted / unsichtbar | `not_found` |
| `409 Conflict` | Doppelbeitritt, Treffen voll, DM existiert bereits | `already_joined`, `meetup_full` |
| `422 Unprocessable Entity` | Validierungsfehler mit `fields` | `validation_failed` |
| `429 Too Many Requests` | Rate-Limit (Login, Schreibrate) | `rate_limited` |
| `500 Internal Server Error` | unerwarteter Serverfehler | `internal_error` |

**Sicherheits-Detail:** Bei nicht sichtbaren Objekten (private Gruppe, fremde Konversation) wird bevorzugt `404` statt `403` zurückgegeben, um Existenz nicht zu leaken — außer wenn der Nutzer das Objekt grundsätzlich sehen darf, aber die konkrete Aktion nicht (dann `403`).

### Error-Code-Katalog (Auszug, englisch & stabil)

`unauthenticated`, `forbidden`, `not_found`, `validation_failed`, `bad_request`, `rate_limited`, `internal_error`, `already_joined`, `meetup_full`, `meetup_cancelled`, `not_a_member`, `not_owner`, `not_participant`, `conversation_exists`, `invalid_credentials`, `email_taken`, `display_name_taken`, `upload_too_large`, `unsupported_media_type`, `csrf_invalid`.

---

## 4. BaseApiController, Auth-Filter & Autorisierungs-Helper (BOLA)

### 4.1 BaseApiController

Gemeinsame Basisklasse (CI4 `ResponseTrait`) für Envelope + Auth-Helper. CRUD-Controller erben davon (Mischform: kein blanker `ResourceController`, ADR-Begründung §6).

```php
abstract class BaseApiController extends \CodeIgniter\Controller
{
    use \CodeIgniter\API\ResponseTrait;

    protected function respondSuccess($data = null, int $status = 200, ?array $meta = null)
    {
        $body = [];
        if ($data !== null) $body['data'] = $data;
        if ($meta !== null) $body['meta'] = $meta;
        return $this->response->setStatusCode($status)->setJSON($body ?: null);
    }

    protected function respondError(string $code, string $message, int $status, ?array $fields = null)
    {
        $err = ['code' => $code, 'message' => $message];
        if ($fields !== null) $err['fields'] = $fields;
        return $this->response->setStatusCode($status)->setJSON(['error' => $err]);
    }

    /** aktueller Shield-User; vom auth-Filter garantiert gesetzt */
    protected function currentUserId(): int
    {
        return auth()->id();
    }
}
```

### 4.2 Zentraler Auth-Filter

Ein `auth`-Before-Filter (`app/Config/Filters.php`) auf die `/api/v1`-Gruppe (außer `register`/`login`/öffentliche GETs). Nutzt Shields Session-Authenticator; bei fehlender/ungültiger Session → `401 unauthenticated` im Envelope (nicht Shields Default-Redirect).

```php
// app/Config/Filters.php (Auszug)
public array $aliases = [
    'auth'     => \App\Filters\ApiAuthFilter::class,     // Shield-Session + JSON-401
    'throttle' => \App\Filters\ThrottleFilter::class,
    'csrf'     => \CodeIgniter\Filters\CSRF::class,
];
```

**CSRF (ADR-004):** CI4-`csrf`-Filter für alle state-changing Methoden (POST/PATCH/PUT/DELETE). Double-Submit/Header-Token: die SPA liest das CSRF-Cookie und sendet es als `X-CSRF-TOKEN`-Header; `fetch` mit `credentials: 'include'`. Bei Mismatch → `403 csrf_invalid`.

### 4.3 Autorisierungs-Helper (BOLA-Schutz)

**Querschnitts-Muss** (`_crosscutting.json`, ADR-004/006): Authentifizierung ≠ Autorisierung. **Jeder** objektbezogene Endpoint prüft serverseitig Mitgliedschaft/Eigentum gegen die maßgeblichen Tabellen (`group_members`, `conversation_participants`, `meetups.owner_id`). React-Route-Gates sind **nur UX**.

Zentrale Helper im Service-Layer (nicht verstreut in Controllern):

```php
final class Authz
{
    public static function requireMeetupOwner(int $meetupId, int $userId): void;     // sonst 403 not_owner
    public static function requireGroupMember(int $groupId, int $userId): void;       // sonst 403 not_a_member
    public static function requireGroupRole(int $groupId, int $userId, array $roles): void; // owner/moderator
    public static function requireConversationParticipant(int $convId, int $userId): void;  // sonst 403/404
    public static function canSeeGroup(Group $g, int $userId): bool;                  // visibility-Logik
}
```

**Regel:** Erst Authentifizierung (Filter) → dann pro-Aktion-Autorisierung (Helper) → dann Validierung → dann Geschäftslogik. Die Autorisierungstabelle ist dieselbe für REST und (späteres) Realtime — es gibt keinen zweiten Pfad.

---

## 5. Validierung — CI4 spiegelt die Zod-Schemas

Single Source of Truth der **Typen** ist Zod (ADR-003, `z.infer`). Die CI4-Validation **spiegelt** dieselben Regeln serverseitig (Client-Validierung ist nie Sicherheit). Beide Seiten müssen synchron gepflegt werden — Konvention: gleiche Feldnamen (englisch), gleiche Grenzen.

Beispiel `meetups`-Create (Zod ↔ CI4):

| Feld | Zod | CI4-Rule | Fehler-`message` (de) |
|---|---|---|---|
| `title` | `z.string().min(3).max(120)` | `required|min_length[3]|max_length[120]` | „Titel muss 3–120 Zeichen lang sein." |
| `spot_id` | `z.number().int().positive()` | `required|is_natural_no_zero|is_not_unique[spots.id]` | „Unbekannter Startplatz." |
| `starts_at` | `z.string().datetime()` (future) | `required|valid_date|future_datetime` (custom) | „Startzeit muss in der Zukunft liegen." |
| `max_participants` | `z.number().int().min(1).optional()` | `permit_empty|is_natural_no_zero` | „Mindestens 1 Teilnehmer." |
| `visibility` | `z.enum(['public','group'])` | `required|in_list[public,group]` | „Ungültige Sichtbarkeit." |

Validierungsfehler werden **immer** als `422 validation_failed` mit `error.fields` (Feld→deutsche Message) zurückgegeben. Deutsche Messages via `app/Language/de/Validation.php` (CI4-Locale `de`).

---

## 6. ResourceController vs. eigene Controller

**Entscheidung (Dossier §6, ADR-konform): Mischform.**
- **CRUD-Ressourcen** (Meetups, Groups, Feed-Posts, Profile) erben von `BaseApiController` und implementieren nur die benötigten Verben — **kein** generischer `ResourceController`/`ResourcePresenter` (vermeidet implizite Magie, bleibt in der Abnahme erklärbar).
- **Nicht-CRUD-Aktionen** (`join`, `leave`, `resolve`, `toggle`, `markRead`) sind **explizite** Controller-Methoden auf expliziten Routen — keine künstliche Pressung in `create/update/delete`.
- Domänenlogik (Transaktionen, Kapazitätsprüfung, abgeleitete Zustände) liegt im **Service-Layer**, nicht im Controller. Controller = dünn (Request parsen → Service → Envelope).

---

## 7. Datei-Upload-Handling

Querschnitts-Problem (`_crosscutting.json`): `writable/` ist nicht öffentlich, `public/` wird vom Vite-Build berührt. **Konsens:** öffentliche Bilder in ein vom Build **unberührtes** Verzeichnis.

| Aspekt | Regel |
|---|---|
| Zielpfad | `public/media/uploads/<context>/` (z.B. `avatars/`, `group_logos/`, `feed/`) — **außerhalb** des Vite-Output, geschützt vor `emptyOutDir` |
| Erlaubte MIME | Allowlist `image/jpeg`, `image/png`, `image/webp` (Server-Prüfung via `finfo`, **nicht** Client-Content-Type); sonst `415 unsupported_media_type` |
| Größenlimit | max. **2 MB** pro Bild; sonst `413/422 upload_too_large`. Zusätzlich `upload_max_filesize`/`post_max_size` in `.htaccess`/`php.ini` setzen |
| Resize | **GD** (auf dem Webspace verfügbar): Avatar max. 512×512, Logo max. 512×512, Feed-Bild max. 1280px Kante; re-encode (zerstört eingebetteten Schadcode) |
| EXIF | beim Re-Encode **gestrippt** (Geo-/Geräte-Metadaten entfernt, Datenschutz) |
| Dateiname | **randomisiert** (`bin2hex(random_bytes(16))` + Endung aus echtem MIME) — kein Original-Name (Path-Traversal/Overwrite-Schutz) |
| Pfadschutz | kein nutzergesteuerter Pfad-Anteil; Verzeichnis hat **kein** PHP-Execute (`.htaccess`: nur statische Auslieferung, `php_flag engine off`) |
| Referenz | DB speichert nur **relativen Pfad** (`avatar_path`, `logo_path`, `image_path`); URL wird im Read aus `baseURL + media/uploads/...` gebildet |
| Quota | Schreibrechte **und** Quota früh auf dem **echten** Webspace testen (ADR-002) |

Chat-Anhänge sind **nicht im MVP** (ADR-009) → der `uploads`-Endpoint bedient nur Avatar/Logo/Feed.

---

## 8. Caching (FileCache, kein Redis)

Kein Cache-Server annehmen (geteilter Host). CI4 **FileCache** (`writable/cache`) für wenige, teure, selten ändernde Reads:

| Read | TTL | Invalidierung |
|---|---|---|
| `GET /spots` (kuratiert, ADR-007) | 1 h | manuell bei Seed-Änderung |
| öffentliche Meetup-Liste (ohne Filter) | 30–60 s | bei Create/Cancel |
| Notification-`unread-count` | nicht gecacht (muss frisch sein) | – |

**HTTP-Caching fürs Polling (ADR-001):** Endpoints, die gepollt werden (Messages-`?since=`, Conversation-Liste), setzen einen **ETag**; bei `If-None-Match`-Match → **`304 Not Modified`** (kein Body, kein DB-Heavy-Read). Statische Medien erhalten `Cache-Control: public, max-age` + ETag.

**TODO (ADR-012/D3):** Beschreibbarkeit von `writable/cache` auf dem konkreten Webspace früh testen; falls FileCache fehlschlägt, auf `null`-Handler (kein Cache) zurückfallen.

---

## 9. Sessions via Shield

Auth-State läuft **vollständig über Shield-Sessions** (ADR-004), nicht über JWT. Server-Sessions sind nötig (Shield Session-Authenticator + CSRF-Token).

- **Session-Handler:** `DatabaseHandler` (Tabelle `ci_sessions`) statt `FileHandler` — `writable/` ist auf dem geteilten Host weniger verlässlich (Dossier §Sessions). MySQL ist ohnehin Source of Truth.
- **Cookie:** HttpOnly, `SameSite=Lax`, `Secure` in Prod (HTTPS). Per JS nicht auslesbar → XSS-Härtung.
- **CSRF:** separates, lesbares CSRF-Cookie (Double-Submit) für die SPA-Header (siehe §4.2).
- Shield-Migrations laufen im normalen Migrations-Lauf mit; `profiles` 1:1 zu Shield-`users` (DATA_MODEL.md §2/§3).

---

## 10. Migrations als Wahrheit, SQL-Dump-Workflow & Seeder

**ADR-002 / Querschnitt §8.** Kein `spark migrate` auf Prod (kein SSH).

### 10.1 Migrations = Schema-Wahrheit
- Alle Tabellen ausschließlich über **CI4-Migrations** (`php spark make:migration`), im Repo versioniert. Reihenfolge & FK-Abhängigkeiten siehe **DATA_MODEL.md §10** (Shield → spots → profiles → groups → meetups → conversations → messages → …).
- **Composite-Indizes von Anfang an** in den Migrations (Dossier §Index-Strategie): `messages(conversation_id, created_at, id)`, `conversation_participants(user_id, conversation_id)` UNIQUE, `meetup_participants(meetup_id, user_id)` UNIQUE, `group_members(group_id, user_id)` UNIQUE, `feed_posts(group_id, created_at, id)`.
- FK-`ON DELETE` bewusst: `CASCADE` (z.B. `messages`→`conversations`) vs. `SET NULL` (z.B. soft-gelöschte Owner) — exakte Festlegung in DATA_MODEL.md.

### 10.2 Deterministischer SQL-Dump für phpMyAdmin
```
1. lokal:  php spark migrate          # Schema aktuell
2. lokal:  php spark db:seed Database # optional Demo-Daten
3. lokal:  mysqldump --no-tablespaces --skip-comments --single-transaction \
             --default-character-set=utf8mb4 db_team15 > deploy/db_team15.sql
4. prod:   db_team15.sql per phpMyAdmin importieren
```
**Determinismus:** `--skip-comments` (entfernt variablen Dump-Timestamp), feste Charset-/Collation-Optionen (`utf8mb4_unicode_ci`) → reproduzierbarer Diff. Der Dump ist ein **Deploy-Artefakt**, kein Quelltext-Schema.

### 10.3 Seeder (Faker)
- `DatabaseSeeder` als kombinierter Einstieg; Faker (vorhanden) für realistische **deutsche** Demo-Daten (Dossier §Seeder): ~30 Piloten, die kuratierten Spots (Wasserkuppe, Tegelberg, Hochfelln …, ADR-007), Meetups in Zukunft **und** Vergangenheit (testet abgeleitete Zustände, §11), Gruppen mit Mitgliedern, Beispiel-Chatverläufe + Reaktionen.
- Domänendaten deutsch; technische Keys/Enums englisch (Konvention).

---

## 11. Kein Cron → abgeleitete Zustände im Read-Pfad

**ADR-002 / Querschnitt §6.** Der geteilte Host hat keinen zuverlässigen Cron. Nur **echte** Zustandsänderungen werden persistiert; zeitabhängige Zustände werden **bei jedem Read** serverseitig berechnet.

| Persistiert (DB) | Im Read berechnet (nicht gespeichert) |
|---|---|
| `meetups.status ∈ {open, cancelled}` | `running` (`starts_at` erreicht), `finished` (`starts_at` + Dauer überschritten) |
| `meetup_participants` (Zeilen) | `is_full` (= `COUNT(participants) >= max_participants`) |
| `messages` (Zeilen) | Unread-Count (`> last_read_message_id`) |

Der Client erhält im Envelope ein **abgeleitetes** Feld (z.B. `display_status: "running"`), das aus dem persistierten `status` + Serverzeit berechnet ist — der DB-Wert bleibt `open`. Damit ist kein Scheduler nötig und keine Drift möglich (DATA_MODEL.md §11 Audit-Trail: `geplant|laeuft|abgesagt|beendet` wurde auf `open|cancelled` reduziert).

---

## 12. Prod-`.env`, Secrets & baseURL

- **`.env` wird NIE deployt** (steht in `.deployignore`). Einmalig manuell per SFTP auf dem Webspace setzen.
- Prod-Werte:
  - `CI_ENVIRONMENT = production` (kein Stacktrace-Leak)
  - `app.baseURL = 'https://team15.wi1cm.uni-trier.de/public/'`
  - `database.default.*` = Prod-DB-Credentials (`db_team15`)
  - `app.forceGlobalSecureRequests = true` (HTTPS)
  - Shield-/`encryption.key` gesetzt (Session-/CSRF-Integrität)
- **Keine Secrets im Repo.** `.deploypass` (SFTP-Passwort für `deploy:remote`) ist lokal und **gitignored**.
- Same-origin (`/public/`) → Cookies funktionieren nativ, **kein** CORS.

**✅ Entschieden (ADR-008):** SMTP unbestätigt → E-Mail-Flows (Verifikation, Passwort-Reset) **nicht im MVP**; Schema-Spalten (`email_verified_at`, `password_resets`) in DATA_MODEL.md zum Nachrüsten vorbereitet, aber kein Endpoint nutzt sie. (Webspace-SMTP testen: TODO D3.)

---

## 13. Build- & Deploy-Reihenfolge

Verbindliche Reihenfolge (Dossier §Build/Deploy, ADR-002). Reale `composer.json`-Scripts:

```
1. composer build:frontend     # cd frontend && npm run build  → Vite-Output nach public/
2. (manuell/einmalig) Prod-.env per SFTP setzen
3. composer deploy:remote      # lftp mirror -R --delete --exclude-glob-from=.deployignore → /web/
4. db_team15.sql per phpMyAdmin importieren (§10.2)
```

**Harte Regeln:**
- `build:frontend` **MUSS vor** `deploy:remote` laufen (sonst veralteter/fehlender SPA-Build in `public/`).
- `frontend/` steht in `.deployignore` (nur der **gebaute** Output wird deployt, nicht der Quelltext) — ADR-002.
- `public/media/uploads/` muss vom Vite-`emptyOutDir` **geschützt** sein (separates Verzeichnis) und darf vom `lftp --delete` **nicht** gelöscht werden → in `.deployignore` als zu erhaltend behandeln, sonst gehen hochgeladene Nutzerbilder bei jedem Deploy verloren. ⚠️ **Kritisch prüfen:** `mirror --delete` löscht remote, was lokal fehlt — `media/uploads/` explizit excludieren.
- `.htaccess` (Redirect auf `/public`, bereits committet) + Prod-`.env` + DB-Import sind die manuellen Out-of-band-Schritte.

`deploy:local` (rsync nach MAMP) ist nur der lokale Spiegel-Workflow zum Testen.

### 13.1 M6-Runbook (konkrete Schritte)

Stand M6: Schema (M1–M5) und Demo-Seed sind vollständig; das Deploy-Tooling existiert seit M2.
**Lokale Artefakt-Vorbereitung** (in diesem Repo, vor jedem Deploy auszuführen):

```bash
# 1) Dev-DB frisch aufsetzen (NIE migrate:refresh — bricht über Shield-Namespaces)
mysql -h127.0.0.1 -P8889 -uroot -proot -e "DROP DATABASE IF EXISTS db_team15; \
  CREATE DATABASE db_team15 CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"
php spark migrate --all
php spark db:seed DatabaseSeeder

# 2) Deterministischen Dump erzeugen (Schema + Demo-Daten) → deploy/db_team15.sql
mysqldump --no-tablespaces --skip-comments --single-transaction \
  --default-character-set=utf8mb4 -h127.0.0.1 -P8889 -uroot -proot db_team15 > deploy/db_team15.sql

# 3) Frontend prod-bauen (base=/public/). Erst public/assets/ leeren → keine veralteten Chunks
#    (emptyOutDir:false bewahrt index.php + media/uploads/, sammelt aber alte Hashes an).
rm -rf public/assets
composer build:frontend
```

> Hinweis: `mysql`/`mysqldump` liegen unter MAMP nicht im PATH — voller Pfad
> `/Applications/MAMP/Library/bin/mysql80/bin/`. `deploy/` und `public/` sind gitignored
> (regenerierbare Artefakte); committet wird nur Quelltext + Doku.

**Live-Push auf den Webspace** (manuelle Out-of-band-Schritte, außerhalb dieses Repos):

```
4. (einmalig) env.prod-Inhalt per SFTP als Server-.env ablegen   (§12; nie aus dem Repo deployen)
5. composer deploy:remote     # lftp mirror -R --delete --exclude-glob-from=.deployignore → /web/
6. deploy/db_team15.sql in phpMyAdmin importieren                (Ziel-DB leeren/anlegen, dann Import)
```

### 13.2 TODO D3 — Webspace-Praxistests (ADR-012/D3, am echten Server)

Direkt nach dem ersten Live-Deploy auf `hosting.wi1cm.uni-trier.de` prüfen:

- [ ] **Upload-Schreibrechte/Quota:** Avatar hochladen → liegt in `public/media/uploads/avatars/`, wird ausgeliefert; `.htaccess`-No-Execute greift; Quota nicht sofort erschöpft.
- [ ] **FileCache:** `writable/cache` ist beschreibbar (sonst auf `null`-Handler zurückfallen, §8).
- [ ] **ETag/`304`:** ein gepollter GET (z. B. `/conversations`, `/notifications`) liefert beim zweiten Abruf mit `If-None-Match` ein **`304`** durch (Apache reicht den Header durch; der CI4-Helper überspringt `304` nur unter dem PHP-Dev-Server).
- [ ] **SMTP:** ob der Webspace ausgehende Mails zulässt (für später; E-Mail-Flows sind im MVP aus, ADR-008).
- [ ] **Ausgehendes HTTPS + `ext-curl`** (Wetter-Proxy ADR-017, KI-Briefing ADR-018): `GET /api/v1/meetups/{id}/weather` eines künftigen Treffens liefert `200` mit `available: true`; danach `GET …/briefing` (setzt `gemini.apiKey` in der Server-`.env` voraus, sonst `not_configured`). Ausgehende Hosts: `api.open-meteo.com` und `generativelanguage.googleapis.com`. Sperrt der Webspace sie (oder fehlt `ext-curl`), antworten die Endpunkte `503 weather_unavailable`/`briefing_unavailable` — die Detailseite zeigt dann nur leise Ersatzzeilen und bleibt sonst voll funktionsfähig.

### 13.3 TODO D4 — Abnahme-Login (ADR-012/D4)

**Entschieden:** Abnahme über den geseedeten Admin **`admin@flightmeet.test` / `FlightMeet!2026`** (Shield-Gruppe
`admin`) plus die Demo-Pilotin **`lena@flightmeet.test` / `passwort123`** (gefüllte Oberflächen: Treffen,
Gruppen, ungelesene Chats + Benachrichtigungen). **Demo-/Local-Only** — vor echtem Publikumsbetrieb ersetzen
(ADR-008-Caveat). Bei Bedarf separate Prüfer-Kennung anlegen.

### 13.4 Abnahme-Präsentation (Demo-Skript)

1. **Login** als Admin bzw. Lena → Dashboard ist gefüllt (Stat-Karten, „Aktuelle Flugtreffen").
2. **Flugtreffen:** Liste/Karte; alle abgeleiteten Status sichtbar (`Offen`/`Ausgebucht`/`Beendet`/`Abgesagt`);
   Detail → Beitreten/Verlassen; Organisator-Aktionen (Bearbeiten/Absagen/Löschen).
3. **Gruppen:** Verzeichnis (Sichtbarkeitsfilter); alle drei Join-Policies (offen/Antrag/Invite); Feed mit
   Pin + Reaktionen; Channels.
4. **Chat:** Sidebar (DMs/Channels/Treffen, ungelesen-Badges); Senden (~2–3 s Polling); Reaktion; Bearbeiten;
   Löschen (Tombstone); Ersteller-Hervorhebung im Treffen-Chat.
5. **Benachrichtigungen:** gemischtes Center, „Alle als gelesen", Badge sinkt.
6. **Quer:** Dark-Mode-Toggle; mobile Ansicht (Bottom-Nav); Tastatur-Fokus im Modal (a11y).

---

## 14. Performance- & Last-Budget (geteilter Host)

Der Uni-Webspace ist verbindungs-/quotenlimitiert; Polling (ADR-001) ist die Hauptlast.

| Hebel | Budget / Regel |
|---|---|
| **Polling-Intervalle** | aktiver Chat **2–3 s**; Listen/Dashboards **15–30 s**; **pausieren** bei `document.hidden` & Fokusverlust. Server lehnt schnellere effektive Raten via Throttle ab |
| **Inkrementelles Polling** | `?since=<message_id>` + **ETag/`304`** → leere/günstige Antworten bei keiner Änderung; schlanker `unread-count`-Endpoint statt Vollabruf |
| **Keyset-Pagination** | `messages` & `feed_posts` cursor-basiert (`WHERE (created_at,id) < cursor ORDER BY ... LIMIT n` + Composite-Index); **Offset** nur für kleine Listen (Gruppenmitglieder). Schont Connection-Limit |
| **MySQL-Quota** | Soft-Delete + Tombstones statt Hard-Delete (moderierbar) — aber `messages`-Wachstum beobachten; keine N+1-Queries (Eager-Load Teilnehmer/Sender) |
| **Connection-Limit** | kurze Transaktionen, kein Long-Polling, Cache für Spots/öffentliche Listen (§8) |
| **Rate-Limit-Idee** | `throttle`-Filter: Login z.B. **5/min/IP** (Brute-Force), Message-Send **~30/min/User**, Upload **~10/min/User** → `429 rate_limited`. Per CI4 `Throttler` (FileCache-/DB-gestützt, kein Redis) |

---

## 15. Datenintegrität bei Nebenläufigkeit

Querschnitts-Muster (`_crosscutting.json` §7): **UNIQUE-Constraint + Transaktion** gegen Races — nie nur ein App-seitiges „SELECT then INSERT".

| Fall | Schutz | Konflikt-Antwort |
|---|---|---|
| Meetup-Beitritt | `UNIQUE(meetup_id,user_id)` + Kapazitätsprüfung **innerhalb** der Transaktion (`SELECT … FOR UPDATE` auf Zähler) | `409 already_joined` / `409 meetup_full` |
| DM-Konversation | deterministischer `UNIQUE dm_key` + **find-or-create** (ADR-005) | bestehende Konversation zurückgeben (idempotent) |
| Gruppen-Mitgliedschaft | `UNIQUE(group_id,user_id)` | `409 already_joined` |
| Reaktion | `UNIQUE(message_id,user_id,emoji)` → Toggle (insert/delete) | idempotent |

---

## 16. Teststrategie

| Ebene | Werkzeug | Pflicht-Abdeckung |
|---|---|---|
| **Backend Feature-Tests** | **PHPUnit** (`composer test`, CI4 `FeatureTestCase` mit Test-DB + Migrations) | **Auth** (Login/Logout/`me`, ungültige Session → 401); **Autorisierung/BOLA** (Nicht-Mitglied/Nicht-Owner → 403/404 auf jeder geschützten Aktion); **Race-Conditions** (paralleler Meetup-Beitritt → genau 1 Erfolg + `meetup_full`/`already_joined`; doppelte DM → eine Konversation); **Validierung** (422-Shape + `fields`); **Envelope/Statuscodes** (Katalog §3) |
| Unit | PHPUnit | Service-Helper (`Authz`, abgeleitete Zustände §11, `dm_key`-Bildung) |
| **Frontend (optional)** | **Vitest** | Zod-Schema-Parsing, Store-/Hook-Logik; **nicht** abnahmekritisch |

**Test-DB-Konvention:** Migrations laufen pro Test-Run frisch (`DatabaseTestTrait` + Refresh), damit Migrations = Wahrheit (§10) auch im Test gilt. Race-Tests simulieren Nebenläufigkeit über parallele Transaktionen/Constraint-Verletzung.

---

## 17. Akzeptanzkriterien (Kapitel)

1. Alle API-Routen liegen unter `/api/v1`; `auto-routing` ist aus; geschützte Routen tragen den `auth`-Filter, schreibende den `csrf`-Filter.
2. Jede Antwort folgt dem Envelope (`data`/`meta` bzw. `error.{code,message,fields?}`) mit korrektem Statuscode aus dem Katalog (§3); `error.code` englisch & stabil, `error.message` deutsch.
3. Auth läuft über **Shield-Session-Cookie** (HttpOnly, kein JWT); jeder objektbezogene Endpoint hat **zusätzlich** zur Authentifizierung eine serverseitige BOLA-Autorisierung über die maßgebliche Mitglieds-/Teilnehmer-/Owner-Tabelle.
4. Uploads: MIME-Allowlist (server-geprüft), ≤2 MB, GD-Resize, EXIF-gestrippt, randomisierter Name, in `public/media/uploads/` ohne PHP-Execute; deploy- und build-fest.
5. Schema entsteht ausschließlich aus CI4-Migrations; Prod via deterministischem `mysqldump` + phpMyAdmin; `DatabaseSeeder` mit Faker liefert deutsche Demo-Daten (inkl. vergangener Meetups zum Test der abgeleiteten Zustände).
6. Keine Cron-Abhängigkeit: `meetups.status` nur `open|cancelled` persistiert, `running`/`finished`/`is_full` im Read berechnet.
7. `composer build:frontend` läuft erzwungenermaßen vor `composer deploy:remote`; `frontend/` und `media/uploads/` sind in `.deployignore` korrekt behandelt; `.env`/Secrets nie im Repo/Deploy.
8. Polling-Intervalle eingehalten (Chat 2–3 s, Listen 15–30 s, Pause bei `document.hidden`); inkrementelles `?since=` + ETag/`304`; Throttle liefert `429 rate_limited`.
9. PHPUnit-Feature-Tests decken Auth, Autorisierung/BOLA und Race-Conditions grün ab.

---

**Verweise:** Vollständiges Schema → [`DATA_MODEL.md`](DATA_MODEL.md). Architektur-Begründungen → [`DECISIONS.md`](DECISIONS.md) (insb. ADR-001 Polling, ADR-002 Deploy/Migrations, ADR-004 Shield-Auth, ADR-005 Chat-Engine, ADR-006 Gruppen-Sichtbarkeit, ADR-007 Spots).
