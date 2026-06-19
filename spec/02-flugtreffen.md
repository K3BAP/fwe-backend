# Flugtreffen (Meetups)

Dieses Kapitel spezifiziert die Domäne **Flugtreffen** vollständig: Datenmodell (im Einklang mit `DATA_MODEL.md`), drei umschaltbare Ansichten, Such-/Filter-/Sortier-/Pagination-Mechanik, Detailansicht, Teilnehmen/Absagen als nebenläufigkeitssichere Transaktion, abgeleiteten Status ohne Cron, den Erstellen-Wizard und die Ersteller-/Admin-Rechte. Nutzersichtbare Labels sind Deutsch, technische Keys/Spalten/API-Felder Englisch (ADR-Querschnitt).

---

## 1. Begriffe & Geltende Entscheidungen

| Thema | Festlegung | Quelle |
|---|---|---|
| Geo-Quelle | Marker aus `spots.lat/lng`; Spot-Auswahl per Autocomplete; `region` aus Spot abgeleitet | ADR-007 |
| Tile-Layer | OSM (kostenlos, kein API-Key), Leaflet | ADR-007 |
| Abgeleiteter Status | nur `open`/`cancelled` persistiert; `full`/`finished` im Read-Pfad berechnet (kein Cron) | ADR-002, Querschnitt „Status ohne Cron" |
| Teilnahme-Integrität | `UNIQUE(meetup_id,user_id)` + Kapazitätsprüfung in DB-Transaktion, `409` bei voll | Querschnitt „Datenintegrität" |
| Suche/Filter | serverseitig über `GET /api/v1/meetups` (LIKE), `limit/offset`-Pagination | flugtreffen.json, openMidLow |
| Autorisierung | Auth-Filter **plus** Objekt-Autorisierung (BOLA): Bearbeiten/Absagen nur Creator/Admin | ADR-004, Querschnitt „BOLA" |
| Chat-Bindeglied | Treffen-Chat = `conversations(type='meetup', context_id=meetup.id)`; Flugtreffen-API liefert nur `meetup_id` | ADR-005 |
| Sprache | DB/Enum/API englisch, Labels deutsch, Datum/Zeit `Intl` de-DE | Querschnitt „Enum/Sprache" |

> **✅ Entschieden (ADR-012/A1):** `users.id` projektweit `BIGINT UNSIGNED`; `meetups.creator_user_id` und `meetup_participants.user_id` sind `BIGINT UNSIGNED`. Der Platzhalter `<user_id-Typ>` in diesem Kapitel = `BIGINT UNSIGNED`.

---

## 2. Datenmodell (Flugtreffen-Ausschnitt)

Verbindlich gemäß `DATA_MODEL.md`, Abschnitt 4 (Flugtreffen & Geo). `regions` ist optional; in diesem Kapitel wird **Region aus dem Spot abgeleitet** (ADR-007), eine separate `regions`-Tabelle wird nur als Lookup für den Filter geführt (siehe §6).

### 2.1 `meetups`

| Spalte | Typ | Constraints / Default | Bedeutung |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| `title` | VARCHAR(150) | NOT NULL | Titel |
| `description` | TEXT | NULL | Beschreibung (Plaintext) |
| `spot_id` | BIGINT UNSIGNED | FK→`spots.id`, NOT NULL, ON DELETE RESTRICT | gewählter Startplatz |
| `spot_name` | VARCHAR(150) | NOT NULL | denormalisiert aus Spot (Snapshot zum Erstellzeitpunkt) |
| `region` | VARCHAR(80) | NOT NULL | denormalisiert aus `spot.region` |
| `lat` | DECIMAL(9,6) | NOT NULL | aus Spot kopiert (Marker) |
| `lng` | DECIMAL(9,6) | NOT NULL | aus Spot kopiert (Marker) |
| `starts_at` | DATETIME | NOT NULL | kombiniertes Datum+Uhrzeit (Single Source of Truth) |
| `experience_level` | ENUM(`beginner`,`advanced`,`expert`,`all`) | NOT NULL, DEFAULT `all` | Zielniveau (siehe §3) |
| `max_participants` | SMALLINT UNSIGNED | NOT NULL, CHECK ≥ 1 | Kapazität |
| `status` | ENUM(`open`,`cancelled`) | NOT NULL, DEFAULT `open` | **nur** persistierter Status |
| `creator_user_id` | `<user_id-Typ>` | FK→`users.id`, NOT NULL, ON DELETE … (s.u.) | Ersteller |
| `created_at` | TIMESTAMP | | |
| `updated_at` | TIMESTAMP | | |
| `deleted_at` | DATETIME NULL | Soft-Delete (moderierbar) | |

**Indizes:** `INDEX(starts_at)`, `INDEX(region)`, `INDEX(experience_level)`, `INDEX(status)`, `INDEX(spot_id)`, `INDEX(creator_user_id)`.

**Denormalisierungs-Begründung:** `spot_name/region/lat/lng` werden beim Erstellen aus dem Spot kopiert. Das hält Karten-/Listen-Reads ohne Join schnell und friert die Geo-Angabe als Snapshot ein, falls ein Admin den Spot später ändert. `spot_id` bleibt als Referenz erhalten.

> **✅ Entschieden:** `creator_user_id` → `users.id` **ON DELETE CASCADE** (DATA_MODEL §4.2). Treffen sind Events (anders als Gruppen): wird eine Person wirklich hart gelöscht (selten, DSGVO), verschwinden ihre Treffen mit — die Löschung wird nicht blockiert. Da User-Löschung primär Soft-Delete ist, greift das praktisch nie.

### 2.2 `meetup_participants`

| Spalte | Typ | Constraints | Bedeutung |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | PK | |
| `meetup_id` | BIGINT UNSIGNED | FK→`meetups.id`, ON DELETE CASCADE | |
| `user_id` | `<user_id-Typ>` | FK→`users.id`, ON DELETE CASCADE | |
| `joined_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |
| | | **UNIQUE(`meetup_id`,`user_id`)** | verhindert Doppelanmeldung |

**Index:** `INDEX(meetup_id)` (für `COUNT`).

**Bewusste Reduktion ggü. Domänen-Dossier:**
- **Kein `role`-Feld.** Der Organisator ist über `meetups.creator_user_id` definiert. Eine `role`-Spalte wäre redundant und kann driften.
- **Kein `status`/`waitlist`-Feld.** Eine Warteliste ist **nicht im MVP-Scope** (kein ADR fordert sie). Kapazität ist hart: voll ⇒ `409`. `participant_count = COUNT(*)`.

> **✅ Entschieden (ADR-015):** **Der Ersteller zählt mit.** Beim Erstellen wird der Creator automatisch in `meetup_participants` eingetragen (eine Transaktion mit `POST /meetups`); er belegt einen `max_participants`-Platz (`≥ 1`), `participant_count`/`free_spots` schließen ihn ein, und die Teilnehmerliste zeigt ihn zuerst (`is_creator`). Austreten als Organisator ist gesperrt (`409 creator_cannot_leave`) — er sagt das Treffen ab oder löscht es.

### 2.3 `spots` (Lookup, ADR-007)

| Spalte | Typ | |
|---|---|---|
| `id` | BIGINT UNSIGNED PK | |
| `name` | VARCHAR(150) NOT NULL | Startplatz-Name |
| `region` | VARCHAR(80) NOT NULL | abgeleitete Region |
| `lat` | DECIMAL(9,6) NOT NULL | |
| `lng` | DECIMAL(9,6) NOT NULL | |
| `description` | TEXT NULL | |
| `created_at` | TIMESTAMP | |

Seed: ~20–30 echte Gleitschirm-Startplätze (Assistent liefert Seed-Liste separat).

> **✅ Entschieden (ADR-012/A4):** Nur **Admin/Seed** pflegen die `spots`-Liste; `GET /api/v1/spots` ist read-only für normale Nutzer, **kein** `POST /spots` im MVP. Map-Picker für freie Spots = Phase 2.

---

## 3. `experience_level`-Enum

Vereinheitlicht auf die Skala aus `DATA_MODEL.md` (gleiche Skala wie Profil, ADR-010). Englische Keys, deutsche Labels:

| Key (DB/API) | Label (UI) | Bedeutung |
|---|---|---|
| `beginner` | „Anfänger" | A-/Grundschein-Niveau |
| `advanced` | „Fortgeschritten" | sicheres Streckenfliegen |
| `expert` | „Experte" | anspruchsvolles Gelände/Bedingungen |
| `all` | „Alle Level" | offen für jedes Niveau (**nur** auf `meetups`, **nicht** im Profil) |

Hinweis: Die im Quell-Dossier genannten deutschen Keys (`anfaenger|fortgeschritten|experte|alle`) werden **verworfen** zugunsten der englischen Keys — Konvention „technische Keys englisch". Übersetzung erfolgt ausschließlich im Frontend.

---

## 4. Abgeleiteter Status (Read-Pfad, kein Cron)

Persistiert ist nur `meetups.status ∈ {open, cancelled}`. Der **effektive Status** (`effective_status`) wird serverseitig bei jedem Read berechnet und im Response ausgeliefert. Frontend rendert ausschließlich `effective_status`.

```
funktion effective_status(meetup, participant_count, now):
    wenn meetup.status == 'cancelled':            -> 'cancelled'   // Abgesagt (hat Vorrang)
    sonst wenn meetup.starts_at < now:            -> 'finished'    // Abgeschlossen
    sonst wenn participant_count >= max_participants: -> 'full'    // Ausgebucht
    sonst:                                        -> 'open'        // Offen
```

| `effective_status` | Label | UI-Verhalten Teilnehmen-Button |
|---|---|---|
| `open` | „Offen" | aktiv (Teilnehmen/Absagen-Toggle) |
| `full` | „Ausgebucht" | deaktiviert für Nicht-Teilnehmer; „Absagen" bleibt aktiv für Teilnehmer |
| `cancelled` | „Abgesagt" | deaktiviert; Hinweis-Badge |
| `finished` | „Abgeschlossen" | deaktiviert (Treffen liegt in der Vergangenheit) |

**Präzedenz** (wichtig, fest verdrahtet): `cancelled` > `finished` > `full` > `open`. Ein abgesagtes Treffen bleibt „Abgesagt", auch wenn das Datum in der Vergangenheit liegt.

**Vergangenheit & Beitritt:** Beitritt zu einem Treffen mit `effective_status ∈ {finished, cancelled}` ist serverseitig verboten (`409 meetup_not_joinable`).

---

## 5. Drei Ansichten + Umschaltung

Alle drei Ansichten konsumieren **denselben** `GET /api/v1/meetups`-Response. Die View-Wahl ist reiner Client-State (Zustand-Store `meetupViewStore`, persistiert in `localStorage`, Default = `cards`). Filter-/Suchzustand lebt in der URL als Query-String (`useSearchParams`), damit Ansicht und Filter teil-/teilbar und über Reloads stabil sind.

| View | Key | Inhalt | Polling-Intervall (ADR-001) |
|---|---|---|---|
| Karte | `map` | Leaflet + OSM-Tiles, ein Marker je Treffen aus `lat/lng`; Popup mit Titel, `starts_at`, `effective_status`, `free_spots`, Link zur Detailseite | 15–30 s, pausiert bei `document.hidden` |
| Tabelle | `table` | Spalten: Titel · Spot · Region · `starts_at` · Level · Teilnehmer (`x/max`) · Status. Sortierbare Header. | 15–30 s |
| Cards (Dashboard) | `cards` | Karten-Grid: Titel, Region/Spot, Datum, Level-Badge, Status-Badge, Belegungs-Balken, Teilnehmen-Button | 15–30 s |

**Umschaltung:** Ein `SegmentedControl` (DaisyUI `join`/`tabs`) mit drei Buttons „Karte / Tabelle / Cards". Wechsel ändert nur die Render-Komponente, **nicht** die Query — der Datensatz bleibt im TanStack-Query-Cache (`queryKey: ['meetups', filterState]`), kein Refetch beim View-Wechsel.

**Karten-Spezifika:**
- OSM-Tile-URL `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, Attribution Pflicht: „© OpenStreetMap-Mitwirkende".
- Bei vielen/nahen Markern optional `leaflet.markercluster` (Phase-2-fähig, MVP: einfache Marker).
- Marker-Farbe nach `effective_status` (z. B. grün=offen, grau=ausgebucht/abgeschlossen, rot=abgesagt).
- `fitBounds` auf die geladenen Marker; leeres Ergebnis ⇒ Default-Center (z. B. Mosel-Region).
- Nur Treffen mit gültigen `lat/lng` werden gemappt (durch Spot-Pflicht immer gegeben).

> **✅ Entschieden:** Die Kartenansicht lädt mit erhöhtem `limit` (z. B. 200) **ohne** Pagination-UI; Tabelle/Cards nutzen `limit=20` + Pager. Bei kleinem Datenbestand unkritisch.

---

## 6. Suche, Filter, Sortierung, Pagination

Alles serverseitig über **eine** Route `GET /api/v1/meetups`. Suche = LIKE über mehrere Felder (für den kleinen Datenbestand ausreichend; FULLTEXT optionales späteres Upgrade).

### 6.1 Query-Parameter

| Param | Typ | Default | Wirkung |
|---|---|---|---|
| `q` | string | – | Volltext (LIKE `%q%`) über `title`, `spot_name`, `region`, `description` |
| `region` | string | – | exakter Match auf `region` (Dropdown-Wert) |
| `level` | enum | – | exakter Match auf `experience_level`; Sonderfall siehe unten |
| `status` | enum | – | Filter auf **effektiven** Status (`open`/`full`/`cancelled`/`finished`) — serverseitig in WHERE/HAVING übersetzt |
| `date_from` | date (ISO) | – | `starts_at >= date_from 00:00` |
| `date_to` | date (ISO) | – | `starts_at <= date_to 23:59:59` |
| `has_free_spots` | bool (`1`) | – | nur Treffen mit `participant_count < max_participants` und nicht `cancelled/finished` |
| `sort` | enum | `starts_at_asc` | s. §6.3 |
| `limit` | int (1–200) | `20` | Pagination |
| `offset` | int ≥ 0 | `0` | Pagination |

**Level-Filter-Semantik:** Wählt der Nutzer im Filter z. B. „Fortgeschritten", werden Treffen mit `experience_level IN ('advanced','all')` zurückgegeben (ein „Alle Level"-Treffen passt zu jedem gewählten Niveau). Der Wert `all` als expliziter Filter liefert alle Treffen (kein Filter).

**Region-Filter-Quelle:** Region-Optionen kommen aus `GET /api/v1/regions` (DISTINCT der in Treffen/Spots vorkommenden Regionen). Dropdown statt Freitext — keine fehleranfälligen Tippvarianten.

### 6.2 `status`-Filter und berechneter Status

Da `effective_status` nicht persistiert ist, wird der `status`-Filter serverseitig in SQL-Bedingungen übersetzt:

| Filterwert | SQL-Bedingung (vereinfacht) |
|---|---|
| `cancelled` | `meetups.status = 'cancelled'` |
| `finished` | `status='open' AND starts_at < NOW()` |
| `full` | `status='open' AND starts_at >= NOW() AND participant_count >= max_participants` |
| `open` | `status='open' AND starts_at >= NOW() AND participant_count < max_participants` |

`participant_count` über `LEFT JOIN … GROUP BY` bzw. korrelierte Subquery; die Kapazitätsbedingung als `HAVING`.

### 6.3 Sortierung (`sort`)

| `sort`-Wert | Reihenfolge |
|---|---|
| `starts_at_asc` (Default) | nächste Treffen zuerst |
| `starts_at_desc` | späteste zuerst |
| `created_at_desc` | neueste Einträge zuerst |
| `participants_desc` | beliebteste zuerst |
| `title_asc` | alphabetisch |

### 6.4 Pagination-Response-Hülle

```json
{
  "data": [ /* Meetup-Listenobjekte */ ],
  "meta": { "total": 137, "limit": 20, "offset": 0, "sort": "starts_at_asc" }
}
```

`total` = Anzahl ohne `limit/offset` (für Pager „Seite x von y"). Für die Karten-View kann `total` ignoriert werden.

---

## 7. Detailansicht `GET /api/v1/meetups/{id}`

Zeigt alle Felder + Teilnehmerliste + freie Plätze + Beziehung des aktuellen Nutzers.

**Response (Beispiel):**

```json
{
  "data": {
    "id": 42,
    "title": "Morgenthermik am Mont Blanc",
    "description": "Frühstart, Treffpunkt Parkplatz...",
    "spot": { "id": 7, "name": "Planfait", "region": "Alpen", "lat": 45.829100, "lng": 6.213400 },
    "region": "Alpen",
    "lat": 45.829100,
    "lng": 6.213400,
    "starts_at": "2026-07-12T07:30:00",
    "experience_level": "advanced",
    "max_participants": 8,
    "participant_count": 5,
    "free_spots": 3,
    "status": "open",
    "effective_status": "open",
    "creator": { "id": 3, "display_name": "Lena W.", "avatar_url": "/media/uploads/ab12.webp" },
    "is_creator": false,
    "is_participant": true,
    "can_edit": false,
    "can_join": false,
    "participants": [
      { "user_id": 3, "display_name": "Lena W.", "avatar_url": "...", "is_creator": true,  "joined_at": "2026-06-20T10:00:00" },
      { "user_id": 9, "display_name": "Tom K.",  "avatar_url": "...", "is_creator": false, "joined_at": "2026-06-21T08:11:00" }
    ],
    "conversation_id": 88,
    "created_at": "2026-06-20T10:00:00",
    "updated_at": "2026-06-20T10:00:00"
  }
}
```

**Server-berechnete Flags (Defense in Depth, nicht nur UX):**
- `participant_count`, `free_spots = max_participants − participant_count`
- `effective_status` (§4)
- `is_creator = (current_user.id == creator_user_id)`
- `is_participant` = existiert Zeile in `meetup_participants`
- `can_edit = is_creator || is_admin`
- `can_join = !is_participant && effective_status == 'open'`
- `conversation_id` = ID der `conversations`-Zeile (`type='meetup'`, `context_id=id`), Bindeglied zum Treffen-Chat (ADR-005). Zugriff/Teilnahme am Chat ist Sache der Chat-Domäne (i. d. R. an Teilnahme gekoppelt).

Teilnehmerliste sortiert: Ersteller zuerst (`is_creator desc`), dann `joined_at asc`.

---

## 8. Teilnehmen / Absagen

### 8.1 Beitreten — `POST /api/v1/meetups/{id}/participants`

Body: leer (Nutzer = `current_user` aus Session). Ablauf **in einer DB-Transaktion**:

1. Lock auf Treffen (`SELECT … FOR UPDATE` auf `meetups.id`), Existenz + nicht `deleted_at`.
2. `effective_status` prüfen: `cancelled`/`finished` ⇒ Rollback, `409 meetup_not_joinable`.
3. `participant_count = SELECT COUNT(*) … FOR UPDATE` (im Lock-Bereich).
4. Bereits Teilnehmer? (`UNIQUE` greift ohnehin) ⇒ **idempotent** `200` mit aktuellem Stand (kein Fehler).
5. `participant_count >= max_participants` ⇒ Rollback, `409 meetup_full`.
6. `INSERT INTO meetup_participants (meetup_id, user_id)`; bei `UNIQUE`-Verletzung durch Race ⇒ als „bereits Teilnehmer" behandeln (idempotent `200`).
7. Commit. Response: aktualisierter `participant_count`, `free_spots`, `effective_status`, `is_participant=true`.

**Antworten:**

| HTTP | `error.code` | Bedeutung | Toast (de) |
|---|---|---|---|
| `200` | – | beigetreten / bereits Teilnehmer | „Du bist jetzt dabei." |
| `401` | `unauthenticated` | nicht eingeloggt | „Bitte einloggen, um teilzunehmen." |
| `404` | `meetup_not_found` | Treffen weg/soft-deleted | „Treffen nicht gefunden." |
| `409` | `meetup_full` | Kapazität erreicht | „Dieses Treffen ist leider ausgebucht." |
| `409` | `meetup_not_joinable` | abgesagt/abgeschlossen | „Beitritt nicht mehr möglich." |

### 8.2 Absagen (austreten) — `DELETE /api/v1/meetups/{id}/participants/me`

- Entfernt die eigene Zeile. **Idempotent:** war der Nutzer nicht angemeldet ⇒ `200` (kein `404`).
- **Ersteller-Sonderfall:** Der Creator kann sich **nicht** über diesen Endpoint austragen, solange das Treffen `open` ist (er belegt den Organisator-Slot). ⇒ `409 creator_cannot_leave` mit Hinweis „Als Organisator kannst du nicht austreten — sage das Treffen ab oder lösche es." (Verhindert verwaiste Treffen ohne Organisator.)
- Response: aktualisierter `participant_count`, `free_spots`, `effective_status` (z. B. `full` → `open`), `is_participant=false`.

### 8.3 Admin-Entfernen — `DELETE /api/v1/meetups/{id}/participants/{userId}`

- Nur Creator des Treffens oder Admin (BOLA-Check). Entfernt fremden Teilnehmer.
- Creator kann sich selbst hierüber **nicht** entfernen (gleicher `creator_cannot_leave`-Guard).
- `403 forbidden`, falls kein Recht.

### 8.4 Frontend: Optimistic Update + Toast

- **Optimistic Update** via TanStack Query `useMutation` mit `onMutate`: lokaler Cache (`['meetups', filters]` Liste + `['meetup', id]` Detail) wird sofort verändert (`participant_count ±1`, `is_participant` toggeln, `effective_status` neu ableiten), Button schaltet sofort um.
- **Rollback** in `onError` (Snapshot zurückspielen) + Fehler-Toast aus `error.code`-Mapping (Tabelle 8.1). Speziell `409 meetup_full`: Rollback + „ausgebucht"-Toast + Refetch (`invalidateQueries`), damit der reale Stand sichtbar wird.
- `onSettled`: `invalidateQueries(['meetup', id])` für Server-Wahrheit.
- Button-States (zustandsabhängig, Server validiert dennoch): „Teilnehmen" / „Absagen" / „Ausgebucht" (disabled) / „Abgesagt" (disabled) / „Abgeschlossen" (disabled) / „Einloggen zum Teilnehmen" (für Gäste).

---

## 9. Erstellen-Wizard

`POST /api/v1/meetups`. Frontend: React Hook Form + Zod (`z.infer` als gemeinsamer Typ für Form **und** DTO, ADR-003). Backend validiert identisch mit CI4-Validation (doppelte Validierung, flugtreffen.json).

### 9.1 Schritte (mehrstufig, aber ein Submit)

1. **Eckdaten:** Titel, Beschreibung, Erfahrungslevel
2. **Ort:** Spot-Autocomplete (`GET /api/v1/spots?q=`); Auswahl füllt read-only `region` und setzt verstecktes `spot_id`; Mini-Karte zeigt Marker an gewählter Position
3. **Zeit & Kapazität:** Datum-Input + Zeit-Input (clientseitig zu `starts_at` kombiniert), `max_participants`
4. **Bestätigung:** Zusammenfassung + Absenden

### 9.2 Zod-Schema (verbindliche Validierung)

| Feld | Regel | Fehlermeldung (de) |
|---|---|---|
| `title` | `string`, trim, 3–150 Zeichen | „Titel muss 3–150 Zeichen lang sein." |
| `description` | `string`, ≤ 5000 Zeichen, optional | „Beschreibung ist zu lang." |
| `spot_id` | `number` (positiv, int), Pflicht | „Bitte einen Startplatz wählen." |
| `starts_at` | `string` datetime-ISO, **muss in der Zukunft** liegen (`> now`) | „Der Termin muss in der Zukunft liegen." |
| `experience_level` | enum `beginner\|advanced\|expert\|all` | „Bitte ein Level wählen." |
| `max_participants` | `number` int, **≥ 1**, ≤ 100 (Sanity-Cap) | „Mindestens 1 Teilnehmer." |

`region`, `spot_name`, `lat`, `lng` werden **nicht** vom Client gesendet — der Server leitet sie aus `spot_id` ab (Vertrauensgrenze; verhindert manipulierte Koordinaten/Regionen).

### 9.3 Server-Verarbeitung (Transaktion)

1. Validieren (CI4); `spot_id` existiert (sonst `422 invalid_spot`).
2. `spot_name/region/lat/lng` aus `spots` kopieren (Snapshot).
3. `INSERT meetups` (`status='open'`, `creator_user_id=current_user`).
4. Creator als ersten Teilnehmer eintragen (`INSERT meetup_participants`) — zählt zur Kapazität (ADR-015, §2.2).
5. `conversations`-Zeile (`type='meetup'`, `context_id=meetup.id`) anlegen + Creator als `conversation_participant` (ADR-005).
6. Commit. `201` mit Detail-Objekt (wie §7).

**Antworten:** `201` (erstellt), `401` (nicht eingeloggt), `422` (`validation_error` mit Feld-Map / `invalid_spot`).

---

## 10. Ersteller-/Admin-Rechte

| Aktion | Endpoint | Wer | Hinweis |
|---|---|---|---|
| Bearbeiten | `PATCH /api/v1/meetups/{id}` | Creator oder Admin | erlaubte Felder: `title`, `description`, `experience_level`, `max_participants`, `starts_at`, `spot_id`. Bei `spot_id`-Änderung werden `spot_name/region/lat/lng` neu abgeleitet. |
| Kapazität senken | `PATCH …` | Creator/Admin | `max_participants` **darf nicht unter** aktuellen `participant_count` gesetzt werden ⇒ `409 capacity_below_current` |
| Absagen | `PATCH …` `{"status":"cancelled"}` | Creator/Admin | Soft-Statuswechsel, behält Historie/Teilnehmer/Chat; `effective_status` wird `cancelled` |
| Löschen | `DELETE /api/v1/meetups/{id}` | Creator/Admin | **Soft-Delete** (`deleted_at`); kaskadiert logisch zu Teilnehmern/Chat-Aufräumung (ADR-005: zugehörige `conversations` bewusst aufräumen) |
| Teilnehmer entfernen | `DELETE …/participants/{userId}` | Creator/Admin | §8.3 |

**Autorisierung (BOLA, Querschnitt):** Jeder mutierende Endpoint prüft serverseitig `is_creator || is_admin` über `creator_user_id` bzw. Shield-Group `admin` — **zusätzlich** zum Auth-Filter. React-Gates sind nur UX. Kein Recht ⇒ `403 forbidden`.

**Absagen vs. Löschen:** „Absagen" ist der bevorzugte Weg (Treffen bleibt mit Status „Abgesagt" sichtbar, Teilnehmer sehen es weiter). „Löschen" (Soft-Delete) blendet es aus den Listen aus.

---

## 11. API-Endpunkte (Übersicht, Präfix `/api/v1`)

| Methode | Pfad | Zweck | Auth |
|---|---|---|---|
| GET | `/meetups` | Liste (Karte/Tabelle/Cards), Suche/Filter/Sort/Pagination (§6) | optional (Gäste lesen) |
| GET | `/meetups/{id}` | Detail + Teilnehmer + Flags (§7) | optional |
| POST | `/meetups` | Erstellen (Wizard, §9) | erforderlich |
| PATCH | `/meetups/{id}` | Bearbeiten / Absagen (§10) | Creator/Admin |
| DELETE | `/meetups/{id}` | Soft-Delete (§10) | Creator/Admin |
| POST | `/meetups/{id}/participants` | Teilnehmen (§8.1) | erforderlich |
| DELETE | `/meetups/{id}/participants/me` | Absagen (§8.2) | erforderlich |
| DELETE | `/meetups/{id}/participants/{userId}` | Teilnehmer entfernen (§8.3) | Creator/Admin |
| GET | `/spots` | Spot-Autocomplete + Geo-Quelle (`?q=`) | optional |
| GET | `/regions` | Region-Filter-Optionen | optional |

**Fehler-Hülle (Querschnitt, einheitlich):**
```json
{ "error": { "code": "meetup_full", "message": "Dieses Treffen ist leider ausgebucht." } }
```
`code` englisch/stabil/maschinenlesbar, `message` deutsch. Validierungsfehler zusätzlich `error.fields: { "starts_at": "Der Termin muss in der Zukunft liegen." }`.

---

## 12. Akzeptanzkriterien

**Ansichten & Umschaltung**
1. Karte, Tabelle und Cards rendern denselben gefilterten Datensatz; Umschalten löst **keinen** Refetch aus (Cache-Reuse).
2. Karte zeigt je Treffen genau einen OSM-Marker an `lat/lng` mit Popup (Titel, Datum de-DE, Status-Label, freie Plätze) und korrekter OSM-Attribution.
3. Die gewählte Ansicht überlebt einen Reload (persistiert); Filter/Suche stehen in der URL und sind teilbar.

**Suche/Filter/Sort/Pagination**
4. `q` findet Treffen über Titel, Spot, Region **und** Beschreibung (serverseitig, case-insensitive).
5. Region-/Level-/Datums-Filter und `has_free_spots` sind kombinierbar; `level=advanced` schließt `all`-Treffen ein.
6. `status`-Filter berücksichtigt den **berechneten** Status (`full`/`finished` korrekt, ohne Cron).
7. `meta.total` ist korrekt; Pager blättert über `limit/offset`; `sort` ändert die Reihenfolge wie in §6.3.

**Detail & Status**
8. Detailansicht zeigt alle Felder, vollständige Teilnehmerliste (Ersteller zuerst markiert), `free_spots` und `effective_status`.
9. `effective_status` folgt der Präzedenz `cancelled > finished > full > open`; ein abgesagtes vergangenes Treffen bleibt „Abgesagt".

**Teilnahme**
10. Zwei gleichzeitige Beitritte auf den letzten freien Platz: genau einer erhält `200`, der andere `409 meetup_full`; `participant_count` überschreitet nie `max_participants` (Transaktion + Lock + `UNIQUE`).
11. Doppelter Beitritt desselben Nutzers ist idempotent (`200`, kein Duplikat).
12. Optimistic Update toggelt den Button sofort; bei `409` erfolgt Rollback + deutscher Toast + Resync mit Serverstand.
13. Beitritt zu `cancelled`/`finished`-Treffen wird mit `409 meetup_not_joinable` abgelehnt.
14. Der Ersteller kann sich nicht über „Absagen" austragen (`409 creator_cannot_leave`).

**Erstellen & Rechte**
15. Wizard validiert client- **und** serverseitig identisch (Zukunftsdatum, `max_participants ≥ 1`, Pflichtfelder, gültiger Spot).
16. Beim Erstellen werden `region/lat/lng/spot_name` serverseitig aus `spot_id` abgeleitet (Client-Werte werden ignoriert) und der Creator als erster Teilnehmer eingetragen; eine `meetup`-`conversation` wird angelegt.
17. Bearbeiten/Absagen/Löschen/Teilnehmer-Entfernen gelingt nur Creator oder Admin; jeder andere erhält `403` — auch wenn die UI-Gate umgangen wird (serverseitig erzwungen).
18. `max_participants` kann nicht unter den aktuellen `participant_count` gesenkt werden (`409 capacity_below_current`).

**Konventionen**
19. Alle DB-Spalten/Enum-Keys/API-Felder/`error.code` sind englisch; alle nutzersichtbaren Labels deutsch; Datum/Zeit via `Intl` de-DE.
20. Kein abgeleiteter Status wird persistiert; es existiert kein Cronjob — `full`/`finished` entstehen ausschließlich im Read-Pfad.
