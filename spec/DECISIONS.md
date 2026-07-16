# FlightMeet – Architektur-Entscheidungen (Decision Log / ADR)

Chronologisches Protokoll getroffener Architekturentscheidungen mit Begründung. Jede Entscheidung
schließt eine oder mehrere offene Fragen aus [`OFFENE_FRAGEN.md`](OFFENE_FRAGEN.md).

Status-Legende: ✅ entschieden · 🔄 vorläufig (Bestätigung ausstehend)

---

## ADR-001 – Realtime-Strategie: Pragmatisches Polling ✅
**Datum:** 2026-06-18 · **Schließt:** T1, C-Fragen (Realtime), Querschnitt „Realtime-Transport"

**Kontext:** Deploy-Ziel ist der geteilte Uni-Webspace (nur SFTP, kein SSH, keine langlaufenden
Prozesse → keine WebSockets/SSE/selbst-gehosteten Daemons). Die Anforderung nannte „Polling ist
vermutlich ungeeignet", echtes Push ist auf diesem Host aber nur über einen extern gehosteten
Dienst möglich.

**Entscheidung:** Kein externer Realtime-Dienst, kein zweiter Datenspeicher. Realtime wird über
**TanStack-Query-Polling gegen die CI4/MySQL-REST-API** gelöst. MySQL ist alleinige Source of Truth.

**Umsetzungsleitlinien:**
- Gestaffelte Intervalle: offener Chat/aktive Konversation ~2–3 s; Listen/Dashboards ~15–30 s;
  Polling pausiert bei `document.hidden` (Tab inaktiv) und ohne Fokus.
- Effizienz: inkrementelle Abfragen via `?since=<message_id|timestamp>`, HTTP-`ETag`/`If-None-Match`
  → `304 Not Modified`; schlanker Endpoint für globale Ungelesen-Zähler.
- Eingehende Nachrichten werden via `queryClient.setQueryData` in den Query-Cache gemerged
  (kein paralleler Message-Store in Zustand).

**Konsequenzen:** Einfachste, webspace-konforme, drittanbieterfreie Lösung; „direkt genug" für die
erwartete kleine Nutzerzahl. Typing-Indikator/Online-Presence sind per Polling unverhältnismäßig und
fallen aus dem Scope (siehe Chat-MVP-Frage). Falls das Projekt je auf eigene Infrastruktur umzieht,
kann der Transport (gekapselt) gegen WebSockets getauscht werden, ohne das Datenmodell zu ändern.

---

## ADR-002 – Deployment & Migrations: SFTP-only, SQL-Dump für Prod ✅
**Datum:** 2026-06-18 · **Schließt:** T2, B-Fragen (Migrations/Deploy)

**Kontext:** Abnahme läuft auf dem Uni-Webspace, Zugang nur via SFTP/lftp (kein SSH).

**Entscheidung:**
- **CI4-Migrations** sind die lokale Schema-Wahrheit (+ Seeder mit Faker für Demo-Daten).
- Für Prod wird ein **deterministischer SQL-Dump** erzeugt und per **phpMyAdmin** importiert
  (kein `spark migrate` auf Prod).
- Frontend wird **lokal** gebaut (`composer build:frontend` → `public/`) und mitdeployt; `frontend/`
  bleibt in `.deployignore`.

**Konsequenzen:** Kein zuverlässiger **Cronjob** → abgeleitete Zustände (`voll`, `abgeschlossen`)
werden im **Read-Pfad** berechnet, nicht per Scheduler persistiert. **SMTP**-Fähigkeit des Webspace
ist unbestätigt → E-Mail-abhängige Flows (Verifikation, Passwort-Reset) standardmäßig nicht im MVP
(Schema aber vorbereiten). Schreibrechte/Quota für Upload-Verzeichnis früh auf dem echten Webspace testen.

---

## ADR-003 – TypeScript jetzt einführen (voll) ✅
**Datum:** 2026-06-18 · **Schließt:** T6

**Kontext:** Frontend ist praktisch leer (nur `App.jsx`/`main.jsx`); `@types/react` bereits installiert.
Zod ist im Stack vorgesehen.

**Entscheidung:** Vollständige Umstellung auf **TypeScript** (`.tsx`, `tsconfig`, `typescript-eslint`).
**Zod-`z.infer`** dient als Single Source of Truth für Formular- (React Hook Form) **und** Server-DTO-
Typen über die untypisierte CI4-JSON-Grenze.

**Konsequenzen:** `App.jsx`/`main.jsx` → `.tsx`; `vite.config.js` ggf. → `.ts`; ESLint auf
typescript-eslint umstellen. Billigster Migrationszeitpunkt (jetzt, da leer).

---

## ADR-004 – Auth: CI4 + CodeIgniter Shield, Session-Cookie ✅
**Datum:** 2026-06-18 · **Schließt:** T4 (Auth-Stack), T5 (Authenticator)

**Kontext:** Auth betrifft jeden geschützten Endpoint. Ein zweiter Auth-Stack (Supabase) wäre für ein
Studierenden-Projekt unnötig riskant; CI4 ist ohnehin vorgegeben. Die SPA wird same-origin von CI4
ausgeliefert → Cookies funktionieren nativ.

**Entscheidung:** **CodeIgniter Shield** als Auth-Lösung; CI4+MySQL ist die **alleinige** Identitäts-
und Autorisierungsquelle. **Kein Supabase.** Plattform-Rollen über Shield-Groups (mind. `user`/`admin`).
**Shield Session-Authenticator** mit **HttpOnly-Cookie** (SameSite) — per JS nicht auslesbar, XSS-sicher.
CSRF-Schutz via CI4 `csrf`-Filter (Double-Submit-/Header-Token für die SPA).

**Konsequenzen:** `composer require codeigniter4/shield`; Shield-Migrations laufen mit; eigenes
`profiles`-Schema 1:1 zu Shield-`users`. API-Client (fetch) sendet Cookies via `credentials: 'include'`
(same-origin) + CSRF-Header. Autorisierung pro Objekt (BOLA-Schutz) zusätzlich zum Auth-Filter:
jeder Endpoint prüft Mitgliedschaft/Eigentum gegen `*_members`/`*_participants`.

---

## ADR-005 – Chat-Engine: eine polymorphe Engine ✅
**Datum:** 2026-06-18 · **Schließt:** T3

**Entscheidung:** **Eine** generische Engine `conversations(type, context_type, context_id)` +
`conversation_participants` + `messages` für **alle** Chat-Orte (Gruppen-Channels, Flugtreffen-Chat,
Direktnachrichten). `type ∈ {group_channel, meetup, direct}`. Ersteller-Hervorhebung = reine
Render-Regel (`sender_id == context.creator_id`), kein DB-Feld. DM via deterministischem
`dm_key`-UNIQUE + find-or-create. Keyset-Pagination über `messages`; Ungelesen via
`last_read_message_id` je Teilnehmer.

**Konsequenzen:** Integrität über Application-Level-Constraints + Tests (polymorphe `context_id` ohne
harten FK); beim Löschen von Gruppe/Treffen zugehörige `conversations` bewusst aufräumen. Gruppen-
Channels sind `conversations` vom `type='group_channel'` (keine separaten `group_messages`).

---

## ADR-006 – Gruppen-Sichtbarkeit: zwei orthogonale Achsen ✅
**Datum:** 2026-06-18 · **Schließt:** T7

**Entscheidung:** Zwei getrennte Felder auf `groups`:
- `visibility ∈ {public, private, unlisted}` — wer die Gruppe (Existenz/Feed) sieht.
- `join_policy ∈ {open, request, invite_only}` — wie man Mitglied wird.

Default neuer Gruppen: `visibility=public`, `join_policy=open`. Der **öffentliche Feed** ist auch bei
privaten Channels für Nicht-Mitglieder sichtbar (sofern `visibility != private` bzw. eigene Feed-
Sichtbarkeitsregel). „Bewerbung" = `join_policy=request` (→ `group_join_requests`); „Einladung" =
`invite_only` (→ `group_invites`).

**Konsequenzen:** Feed-Sichtbarkeit vs. Channel-Sichtbarkeit sind getrennt zu autorisieren.

---

## ADR-007 – Geo-Daten: kuratierte `spots`-Tabelle + Autocomplete ✅
**Datum:** 2026-06-18 · **Schließt:** T8 (Mechanismus)

**Entscheidung:** Tabelle `spots(id, name, region, lat, lng, …)` mit ~20–30 echten Gleitschirm-
Startplätzen als Seed (Assistent liefert die Seed-Liste). Beim Erstellen eines Flugtreffens wählt der
Ersteller den Spot per **Autocomplete**; `region` wird aus dem Spot abgeleitet. Marker auf der Leaflet-
Karte kommen aus `spot.lat/lng`. Tile-Layer: OSM (kostenlos).

**Konsequenzen:** Garantiert valide Marker, keine Geocoding-/Rate-Limit-Abhängigkeit, normalisierte
Region. Späteres Zielbild optional: zusätzlicher Map-Picker für nicht gelistete Spots (Phase 2).
**Entschieden (ADR-012/A4):** nur Admin/Seed pflegen die Liste; kein `POST /spots` im MVP (Map-Picker = Phase 2).

---

## ADR-008 – Projekt-Scope der Zusatzfeatures ✅
**Datum:** 2026-06-19 · **Schließt:** T10, T12, T13 (Scope-Anteil), Lücken L1/L2/L3/L4

**Entscheidung – IM Scope:**
- ✅ **In-App-Benachrichtigungen** (Notification-Center + globale Badge-Zähler; passt zur Polling-
  Architektur, da gleicher Read-Pfad). `notifications`-Tabelle + ungelesen-Aggregat.

**Entscheidung – NICHT im MVP-Scope (→ „Später/Optional"):**
- ❌ Melde-/Moderationssystem (nur Basis-Admin-Rolle `user`/`admin` + Soft-Delete vorhanden; kein
  Report-Workflow). Schema mit `deleted_at`/`deleted_by` aber vorbereiten.
- ❌ E-Mail-Verifikation & Passwort-Reset (keine SMTP-Abhängigkeit). Schema-Spalten
  (`email_verified_at`, `password_resets`) zum Nachrüsten vorsehen.
- ❌ Impressum & Datenschutzerklärung als Pflicht-Feature.
  **⚠️ Rechtlicher Vorbehalt:** Sobald FlightMeet öffentlich (über die reine Hochschul-Abnahme hinaus)
  betrieben wird, sind Impressum (§5 DDG) und Datenschutzerklärung (DSGVO) in DE verpflichtend. Dann
  nachzuziehen. Für die Abnahme als reines Demo-Projekt akzeptiert.

---

## ADR-009 – Chat-MVP-Umfang: „Mittel" ✅
**Datum:** 2026-06-19 · **Schließt:** T9

**Entscheidung – MVP enthält:** Nachrichten senden · paginierte History (Keyset) · Ungelesen-Zähler ·
Ersteller-Hervorhebung (Treffen-Chat) · **Emoji-Reaktionen** (`message_reactions`) · **Bearbeiten/
Löschen** als Soft-Edit/Delete (`edited_at`, `deleted_at`, Tombstone-Anzeige).

**Nicht im MVP:** Anhänge/Bilder, @-Mentions (Phase 2); Typing-Indikator & Online-Presence (mit
Polling unverhältnismäßig → gestrichen).

---

## ADR-010 – Pilotenprofil: „Erweitert" ✅
**Datum:** 2026-06-19 · **Schließt:** Auth-Profilfelder-Frage

**Entscheidung:** `profiles` enthält über Pflicht (Profilbild, Anzeigename, Bio) hinaus:
`experience_level` (gleiche Enum-Skala wie Flugtreffen) · `license_class` (Schein/Lizenz) ·
`glider` (Marke/Modell, Freitext) · `home_region` · `flight_hours` (geschätzt, Integer).
Alle Zusatzfelder **optional** (nullable). Pflicht bei Registrierung bleibt minimal (Anzeigename;
Bild/Bio/Pilotdaten im Profil-Setup nachträglich).

**Entschieden (ADR-012/C2):** Öffentliche Profilkarte = Bild/Name/Bio/Erfahrungslevel; `home_region`,
`glider`, `license_class`, `flight_hours` nur für eingeloggte Nutzer (serverseitig gefiltert).

---

## ADR-011 – Bio-Format: eingeschränktes Markdown + doppeltes Sanitizing ✅
**Datum:** 2026-06-19 · **Schließt:** T11

**Entscheidung:** Bio als **eingeschränktes Markdown** (Fett, Kursiv, Listen, Links, Überschriften).
Rendering client-seitig mit `react-markdown` **ohne** `rehype-raw` (kein rohes HTML), zusätzlich
Tag-/Attribut-Allowlist-Sanitizing; Server speichert Rohtext + validiert/begrenzt Länge.
**Chat-Nachrichten** dagegen **Plaintext + Auto-Linkify** (Performance/Sicherheit).

**Konsequenz:** XSS-Sanitizing ist nicht verhandelbar; gilt überall, wo die Bio gerendert wird
(v.a. die überall eingebundene Profilkarte).

---

## ADR-012 – Interview-Runde 4: Schema-Detail- & Produkt-Entscheidungen ✅
**Datum:** 2026-06-19 · **Schließt:** Gruppe A–D aus [`OFFENE_FRAGEN.md`](OFFENE_FRAGEN.md)

**Schema-Blocker (Gruppe A):**
- **A1 `users.id`:** durchgängig **`BIGINT UNSIGNED`**. Die Shield-`users`-Migration wird so überschrieben,
  dass `users.id BIGINT UNSIGNED` ist; **alle** user-FKs (`userref`) sind `BIGINT UNSIGNED`. Ein Typ im ganzen Schema.
- **A2 Chat-Polling-Delta:** Spalte **`messages.updated_at`** (TIMESTAMP(3)) einführen. Edits, Soft-Deletes
  **und** Reaktions-Änderungen „touchen" `updated_at` der betroffenen Nachricht. Der Live-Tail liefert
  `id > :since_id` **UND** `updated_at > :since_ts`, damit nachträgliche Änderungen live ankommen.
- **A3 Meetup-Chat-Unikat:** genau **eine** `conversation` pro Meetup — erzwungen über eine generierte
  Spalte `meetup_uniq` (= `context_id` nur wenn `type='meetup'`, sonst NULL) mit **UNIQUE**-Index.
  Für `group_channel` bleibt Mehrfachvorkommen pro Gruppe erlaubt.
- **A4 Spots:** nur **Admin/Seed** pflegen die `spots`-Liste; **kein** `POST /spots`, **kein** `created_by` im MVP.

**Produkt & Sichtbarkeit (Gruppe B):**
- **B1 Gäste-Lesezugriff:** Flugtreffen-Liste/-Detail, Gruppen-Verzeichnis, öffentliche Profile und
  öffentliche Gruppen-Feeds sind **ohne Login lesbar**. Alle Schreib-/Teilnahme-/Chat-Aktionen erfordern Login.
- **B2 Gruppen-Feed:** Broadcast (nur Admin-Posts) **+ Emoji-Reaktionen** → neue Tabelle **`feed_post_reactions`**.
  **Keine** Kommentare.
- **B3 `private`+`open`:** **erlaubt** (ungewöhnlich), mit UI-Warnung beim Anlegen — nicht per Validierung verboten.
- **B4 Moderator:** hat **keinen** Zugriff auf `admin`-Channels (nur `owner`/`admin`).
- **B5 Gruppe ↔ Treffen:** **keine** Verknüpfung im MVP. `meetups.group_id`/`visibility='group'` bleiben als
  **vorbereitetes, ungenutztes** Schema (Nachrüstung möglich).

**Felder & Detail (Gruppe C):**
- **C1 `license_class`:** **Freitext** (`VARCHAR(60)`), kein Enum.
- **C2 Profil-Sichtbarkeit:** öffentliche Profilkarte zeigt **Bild, Name, Bio, Erfahrungslevel**;
  `home_region`, `glider`, `license_class`, `flight_hours` nur für **eingeloggte** Nutzer.
- **C3 Banner:** nur `logo_path`, **kein** Banner im MVP.
- **C4 `groups.owner_user_id`-FK:** **`ON DELETE RESTRICT`** + app-seitiger Owner-Transfer-Zwang (keine verwaisten Gruppen).
- **C5 Konversationen:** **Soft-Delete** beim Löschen der Domänen-Entität (History eingefroren, read-only).
- **C6 Edit-Fenster:** Nachrichten **15 Minuten** ab `created_at` bearbeitbar; danach gesperrt (Soft-Delete weiter möglich).
- **C7 Notification-Aggregation:** **eine** `message_received`-Notification pro Konversation, beim Lesen aufgelöst.
- **C8 `notifications.type`:** `VARCHAR` (erweiterbar). MVP-Key-Satz: `meetup_join`, `meetup_cancelled`,
  `meetup_updated`, `group_join_request`, `group_request_approved`, `group_invite`, `message_received`,
  `group_feed_post`, `group_role_changed`.

**Rahmen (Gruppe D):**
- **D1:** UI durchgängig **Deutsch**, technische Keys/DB/API/`error.code` Englisch (bestätigt).
- **D2:** Keine formalen Bewertungskriterien außer der Aufgabenstellung. Abgabe = **8–10 min Präsentation**
  (Aufbau · umgesetzte Funktionen · was war einfach/schwierig) **+ Diskussion** (ein Teil der Gruppe setzt
  dieselbe Aufgabe in **Vanilla HTML/JS + CI4** ohne React um). → Treiber für **ADR-013**.
- **D3 (TODO, vor/bei Deployment):** SMTP-Fähigkeit, Schreibrechte/Quota für `public/media/uploads/` und
  `ETag`/`304`-Durchreichung auf dem **echten** Webspace testen.
- **D4 (TODO, vor Abgabe):** finaler Admin-Login (gemeinsame Demo-Credentials vs. dem Prüfer separat).

---

## ADR-013 – Code-Qualität & Architektur-Prinzipien (verbindlich) ✅
**Datum:** 2026-06-19 · **Quelle:** Nutzer-Feedback (Runde 4), [[feedback-code-quality]]

**Kontext:** Das Ergebnis wird in 8–10 min präsentiert und in einer Diskussion gegen eine Vanilla-/CI4-
Variante verteidigt; der Nutzer prüft den Code **intensiv** und muss ihn nach kurzer Zeit verstehen.
**Lesbarkeit & saubere Struktur sind ein erstklassiges Projektziel, gleichrangig zu Funktionalität.**

**Verbindliche Prinzipien (gelten für jede Implementierungsphase):**
- **Keine Gottklassen/-Komponenten.** Single Responsibility; kleine, fokussierte Einheiten.
- **Backend-Schichtung:** dünner **Controller** → **Service/Library** (Domänenlogik) → **Model** (Datenzugriff).
  Keine Geschäftslogik in Controllern oder Models. Autorisierung (BOLA) zentral, nicht verstreut.
- **Frontend:** **feature-basierte** Struktur; UI-Komponenten „dumm", Logik in Hooks/Services; klare
  State-Grenze (TanStack Query = Server-State, Zustand sparsam = UI-State; siehe Kap. 05).
- **Konsistenz:** sprechende Namen, einheitliche Konventionen, einheitlicher Fehler-Envelope, DRY,
  frühe Validierung. Kommentare nur wo nicht offensichtlich.
- **Lesbarkeit > Cleverness.** Der React-Code soll als nachvollziehbare Referenz taugen.

**Wie anwenden:** Meilensteine so schneiden, dass **jede Phase eigenständig lauffähig und reviewbar** ist.

---

## ADR-014 – Spec-Review-Ergänzungen (Chat) ✅
**Datum:** 2026-06-19 · **Quelle:** gemeinsamer Spec-Durchgang (Datenmodell & Chat-Engine)

- **Reply-to im Chat-MVP** (erweitert ADR-009): Einfache **Antworten auf eine Nachricht** sind Teil des
  MVP. `messages.reply_to_id` (self-ref, `ON DELETE SET NULL`) wird genutzt; die UI zeigt über der
  Antwort eine kleine **Zitat-Vorschau** (Autor + gekürzter Text). **Nur eine Bezugsebene**, keine
  verschachtelten Threads. Bei gelöschter Bezugsnachricht: Hinweis „Nachricht nicht mehr verfügbar".
- **Verwaiste Konversationen:** Absicherung ausschließlich über **Service-Aufräumen** beim Löschen der
  Domänen-Entität + **Integrationstests** (DATA_MODEL §6). **Kein** Admin-Wartungs-Endpunkt im MVP.

---

## ADR-015 – Spec-Review-Ergänzungen (Flugtreffen & Profil) ✅
**Datum:** 2026-06-19 · **Quelle:** gemeinsamer Spec-Durchgang (Datenmodell, Rest)

- **Keine Warteliste im MVP:** Volles Treffen ⇒ Teilnehmen blockiert (`409 meetup_full`), entspricht der
  Aufgabenstellung wörtlich.
- **Organisator zählt mit:** Der Ersteller wird beim Anlegen (gleiche Transaktion wie `POST /meetups`)
  automatisch als Teilnehmer eingetragen und belegt einen `max_participants`-Platz (`≥ 1`);
  `participant_count = COUNT(*)` schließt ihn ein. Austreten als Organisator ist gesperrt
  (`409 creator_cannot_leave`) — er sagt ab/löscht stattdessen.
- **`meetup_participants` schlank** (DATA_MODEL an Kapitel 02 angeglichen, ADR-013): **kein** `role`-Feld
  (Organisator via `meetups.creator_user_id` abgeleitet) und **kein** `status`-Feld (Teilnahme = Zeile
  existiert, Absagen = Zeile löschen; keine `waitlist`/`declined`-Werte). Spalten: `id, meetup_id,
  user_id, joined_at` + `UNIQUE(meetup_id,user_id)`.
- **@handle bestätigt:** `profiles.handle` (optional, UNIQUE) bleibt für Profil-URLs `/profil/{handle}`
  und spätere @-Mentions.

---

## ADR-016 – Liefermodell: UI-Prototyp zuerst, dann verkabeln ✅
**Datum:** 2026-06-19 · **Quelle:** Nutzer (nach Vorliegen des Claude-Design-Entwurfs)

**Kontext:** Ein Claude-Design-Entwurf (Design System + Prototyp) liegt vor; **Datenmodell & API-DTOs
stehen bereits vollständig fest** ([`DATA_MODEL.md`](DATA_MODEL.md), [`API.md`](API.md)).

**Entscheidung:** Statt vertikaler Feature-Slices wird **zuerst die gesamte UI als klickbarer Prototyp**
mit typisierten Mock-Daten gebaut (**M0** Design-System, **M1** Prototyp), danach **domänenweise** mit
echtem Backend verkabelt (**M2–M5**), **M6** Politur/Deploy.

**Schlüssel (geringes Rework):** eine **Daten-Zugriffs-Naht** — typisierte Query/Mutation-Hooks geben
**DTOs** zurück (Zod-`z.infer` exakt nach `API.md`); in M1 aus **Mocks**, ab M2 **pro Domäne** auf echtes
`fetch` umgestellt. UI-Komponenten bleiben unverändert.

**Konsequenzen:** früh sichtbarer/präsentierbarer Stand (stark für die Abnahme); Risiko „Backend zu spät"
wird aktiv gemanagt (M2–M5 nicht quetschen). [`MILESTONES.md`](MILESTONES.md) neu strukturiert (M0–M6).

---

## ADR-017 – Wetter am Flugtreffen: Open-Meteo hinter einem Backend-Proxy ✅
**Datum:** 2026-07-10 · **Quelle:** Nutzer · **Löst:** [`OFFENE_FRAGEN.md`](OFFENE_FRAGEN.md) FT12 (Option B)

**Kontext:** Die Detailseite eines Flugtreffens zeigt Ort und Zeit, aber nicht, ob geflogen werden kann.
Für Gleitschirmflieger entscheidet vor allem der **Bodenwind (10 m) samt Böen**; Höhenwind (850 hPa
≈ 1500 m) und CAPE (Thermik) ergänzen das Bild. `spots`/`meetups` führen bereits `lat`/`lng` (ADR-007),
`starts_at` liegt als UTC-DATETIME vor — die Vorhersage ist damit rein lesend ableitbar.

**Entscheidung:**
1. **Datenquelle Open-Meteo** (`/v1/forecast`) — kostenlos, **kein API-Key**, kein Vertrag, keine
   Registrierung. Passt zum Webspace-Deployment (ADR-002) und zur Nicht-Kommerzialität des Projekts.
2. **Backend-Proxy statt Direktaufruf aus dem Browser:** `GET /api/v1/meetups/{id}/weather` (öffentlich,
   wie die übrigen Treffen-Reads). Gründe: der Server leitet Koordinaten und Zeitpunkt aus der
   Meetup-Zeile ab (**der Client übergibt nie eigene Koordinaten**); die Antwort trägt den normalen
   Envelope und läuft dadurch unverändert durch `apiFetch` inkl. ETag/`304`; der serverseitige Cache
   entkoppelt uns von Open-Meteos Kontingent; `ThrottleFilter` (`throttle:weather,30`) begrenzt Missbrauch.
3. **Cache:** FileCache (`Config\Cache`, bereits konfiguriert), Schlüssel = auf 2 Nachkommastellen
   gerundete Koordinate (~1,1 km) + Datumsfenster, **TTL 30 min**. Gecacht wird die **Rohantwort** —
   `is_current` und das Trend-Fenster hängen von „jetzt" ab und dürfen nicht mit einfrieren. Kein Cron
   (ADR-002): der Cache füllt sich beim ersten Leser.
4. **`timezone=UTC`:** `meetups.starts_at` ist UTC (siehe Zeitzonen-Pin in `Config/Events.php`), damit ist
   die Stundenachse von Open-Meteo direkt vergleichbar — keine Zeitzonen-Arithmetik im Backend.
5. **Nicht-Verfügbarkeit ist Datum, kein Fehler:** vergangene Treffen (`past`, mit 2 h Kulanz für
   laufende), Treffen jenseits des 16-Tage-Horizonts (`out_of_range`) und Treffen ohne Koordinaten
   (`no_location`) liefern `200 { available: false, reason }` — **ohne** Upstream-Call. Nur ein echter
   Ausfall (Timeout, 5xx, fehlendes `ext-curl`) ergibt `503 weather_unavailable`.
6. **Darstellung:** Bodenwind und Böen werden farblich betont (DaisyUI-Tokens `success`/`warning`/
   `error` ab 20/30 bzw. 25/35 km/h). Das ist bewusst eine **Hervorhebung der Zahl, keine
   Flugempfehlung** — die Einschätzung bleibt beim Piloten (Haftung, und wir kennen den Startplatz nicht).

**Konsequenzen:** Erster ausgehender HTTP-Call der Anwendung (`service('curlrequest')`, Timeout 4 s) →
**Deploy-Check nötig**: `ext-curl` + ausgehendes HTTPS auf dem Uni-Webspace (siehe
[`06-backend-deployment.md`](06-backend-deployment.md) §13). Fällt das aus, degradiert die Seite sauber:
das Panel zeigt eine leise Ersatzzeile, alles andere funktioniert. Abgesagte, aber künftige Treffen zeigen
weiterhin Wetter (die Absage kommuniziert die Detailseite selbst) — die Regel bleibt rein zeitbasiert.

---

## ADR-018 – KI-Flug-Briefing: Gemini hinter dem Backend-Proxy ✅
**Datum:** 2026-07-10 · **Quelle:** Nutzer (Demo-Feature mit kostenlosem Gemini-Key)

**Kontext:** Das Wetter-Panel (ADR-017) zeigt Rohwerte. Als Demonstration einer KI-Integration soll
ein Klick daraus eine 2–3-sätzige deutsche Zusammenfassung erzeugen. Constraints wie gehabt:
Shared Webspace, kein Budget (kostenloser API-Key), Haftungsvorsicht bei einem Risikosport.

**Entscheidung:**
1. **Gemini API** (`generateContent`, Standard-Modell `gemini-flash-lite-latest` — Googles Evergreen-Lite-Alias:
   ältere Modell-IDs sind für neue Keys gesperrt, und Nicht-Lite-Flash „denkt" selbst bei Mini-Prompts 12–15 s; per `Config\Gemini` bzw. `gemini.model` in
   `.env` austauschbar). Kostenloser Key über https://aistudio.google.com/apikey.
2. **Backend-Proxy, Key nur serverseitig:** `GET /api/v1/meetups/{id}/briefing` (öffentlich wie das
   Wetter, `throttle:briefing,10`). Der Key steht ausschließlich in `.env`/`env.prod` (gitignored)
   und erreicht nie den Browser — exakt das von Googles eigener Doku empfohlene Muster.
3. **Nur kuratierte Daten im Prompt** (Spot, Region, Level, Messwerte, Windverlauf) — bewusst kein
   Treffen-Titel und keine Beschreibung, damit Nutzertext keine Instruktionen einschleusen kann.
4. **Beschreiben, nie freigeben:** die System-Instruktion verbietet Flugempfehlungen/Freigaben/
   Warnungen; die UI kennzeichnet den Text als „KI-generiert … keine Flugfreigabe". Verlängert die
   ADR-017-Haltung (Farbbetonung ≠ Empfehlung) auf generierten Text.
5. **Nicht-Verfügbarkeit ist Datum:** Wetter-Gründe (`past`/`out_of_range`/`no_location`) werden
   durchgereicht, fehlender Key = `not_configured` — alles `200 {available:false, reason}` ohne
   Upstream-Call. Nur ein echter Gemini-Ausfall (Timeout/429/5xx/leere Antwort) → `503
   briefing_unavailable`; bei 429 mit „ausgelastet"-Meldung. Fehlschläge werden nie gecacht.
6. **On-Demand + Cache:** Erzeugung nur auf Button-Klick (Frei-Kontingent!), Ergebnis 30 min im
   FileCache, Schlüssel an die Wetter-Zielstunde gekoppelt — Briefing und angezeigte Werte bleiben
   konsistent, ein laufendes Treffen wandert stündlich mit. `maxOutputTokens` großzügig (1024):
   Flash-Modelle „denken" intern mit und zählen diese Tokens aufs Budget an — ein knappes Limit
   schneidet den Text ab. **Kein** `thinkingConfig`: dessen Parameter sind je Modellgeneration
   inkompatibel (2.5 nimmt `thinkingBudget`, 3.x lehnt es mit 404 ab), das Modell ist aber frei
   konfigurierbar.

**Konsequenzen:** Zweiter ausgehender HTTP-Call der Anwendung (nach Open-Meteo) → D3-Check um
`generativelanguage.googleapis.com` + Server-Key erweitert. Ohne Key läuft die App unverändert
(leise „nicht eingerichtet"-Zeile) — das Feature ist strikt Beiwerk. Der geteilte
`curlrequest`-Service verlangt beim Gemini-Call absolute URL + Optionen pro Request (der
WeatherService erzeugt die Instanz ggf. zuerst, mit Open-Meteo-BaseURI und 4-s-Timeout).

---

## ADR-019 – Admin-Dashboard: Verwaltung statt Moderation ✅
**Datum:** 2026-07-16 · **Quelle:** Nutzer (ausdrücklich vom Professor gefordert)

**Kontext:** Die Shield-Gruppe `admin` existierte seit M2, war aber nur ein BOLA-Override in den
Services plus ein Badge in der TopBar — eine eigene Oberfläche fehlte (in ADR-008 zurückgestellt,
in CLAUDE.md §14 als „deferred" geführt). Gefordert ist volle Kontrolle über die Instanz:
Benutzer, Flugtreffen, Gruppen.

**Entscheidung:**
1. **Zwei Lese-Endpunkte, keine zehn Schreib-Endpunkte.** `PATCH/DELETE /meetups/{id}` und
   `/groups/{id}` akzeptieren Admins längst über den `$isAdmin`-Parameter, der von Anfang an durch die
   Services läuft — die Admin-UI ruft **diese** Routen. Neu unter `/admin` sind nur Lesesichten
   (Kennzahlen, Nutzer, Treffen, Gruppen, Startplätze) plus Schreibpfade für Benutzer und Spots, die
   noch nie eine hatten. Eine zweite Tür zum selben Service-Aufruf wäre reines Duplikat (ADR-013).
2. **Löschen von Konten = ausschließlich Shields Soft-Delete** (`users.deleted_at`), plus
   Wiederherstellen. Kein Hard-Delete: `groups.owner_user_id` ist `ON DELETE RESTRICT`, ein gelöschter
   Gruppen-Eigentümer würde am FK scheitern; und ein Fehlklick in der Demo wäre nicht umkehrbar.
   **Folge, die benannt gehört:** Soft-Delete ist ein UPDATE, es feuert also keine Kaskade — Treffen,
   Mitgliedschaften, Feed-Posts und Nachrichten des Kontos bleiben bestehen und zeigen weiter Name und
   Avatar. Das Konto ist vom Login ausgeschlossen, die Person nicht von der Plattform. Der
   Lösch-Dialog sagt das wörtlich, statt es den Nutzer entdecken zu lassen.
3. **Selbstschutz per 409** (`admin_self_demote`/`admin_self_deactivate`/`admin_self_delete`) statt
   403 — die Rechte fehlen ja nicht, das Ziel ist ungültig. Weil der `admin`-Filter garantiert, dass
   der Handelnde Admin ist, folgt daraus die **Invariante: es gibt immer mindestens einen Admin**;
   eine „letzter Admin"-Prüfung erübrigt sich. Das DTO trägt `is_self`, damit das UI die drei
   Aktionen ausgraut, statt in den 409 zu laufen — die Prüfung im Service bleibt die Wahrheit.
4. **Keine Inhalts-Moderation.** ADR-005 gibt dem Chat bewusst *keinen* Admin-Override, ADR-008 hat
   den Melde-Workflow zurückgestellt. Das Dashboard verwaltet damit **Konten und Entitäten, nicht
   Sprache**. Wer Chat-Moderation will, muss zuerst ADR-005 aufmachen.
5. **`active` wird jetzt pro Request geprüft** (`ApiAuthFilter` → `403 account_suspended` + Logout).
   Vorher sah nur `AuthService::login()` das Flag: eine bereits offene Sitzung lief nach der Sperre
   unbegrenzt weiter — die „Sperre" war faktisch nur eine Login-Hürde. Soft-Delete braucht das nicht,
   dort verwirft Shields `Session::checkUserState()` die Session von selbst (der Provider findet den
   User nicht mehr).
6. **Startplatz-Pflege löst ADR-012/A4 ein** („nur Admin/Seed pflegen die `spots`-Liste"); das dortige
   „kein `POST /spots`" betraf die *öffentliche* Route — bis jetzt hieß „Admin" phpMyAdmin von Hand.
   Löschen ist ein Hard-Delete und unbedenklich: der FK ist `ON DELETE SET NULL` und Ort/Koordinaten
   liegen als Schnappschuss auf der Treffen-Zeile, das Treffen behält also Ortsangabe, Karte und
   Wetter — nur die Verknüpfung entfällt.
7. **Kein Mock-Store.** Die Naht aus ADR-016 existiert, damit das UI *vor* dem Backend gebaut werden
   konnte (M1 → M2–M5); diese Domäne entstand backend-first und alle `USE_MOCKS`-Flags stehen längst
   auf `false`. Ein `USE_MOCKS.admin` samt Store wäre Code, den kein Pfad je erreicht. Die wertvolle
   Hälfte der Naht — der typisierte DTO-Vertrag — steckt vollständig in `api/schemas/admin.ts`.

**Konsequenzen:** `isAdmin()` wandert in den `BaseApiController` (war in zwei Controllern dupliziert);
neuer `admin`-Filter (403-Envelope). Der Admin-Bereich ist lazy geladen und hängt an einem
`RequireAdmin`-Guard — der ist reine UX, durchgesetzt wird serverseitig. Der Zugang liegt in der TopBar
(Badge + Desktop-Nav), **nicht** in `layout/nav.ts`: das Array speist auch die mobile BottomNav, die auf
vier Einträge ausgelegt ist — mobil ist das Badge deshalb der einzige Weg hinein. Gruppen bekommen ein
Gegenstück zum Soft-Delete (`POST /admin/groups/{id}/restore`), sonst wäre die (gewollte) Anzeige
gelöschter Gruppen eine Sackgasse. Die Admin-Gruppenliste ist eine **eigene** Abfrage neben
`GroupService::list()`: dort ein `$isAdmin` einzuziehen, das Sichtbarkeits- *und* Soft-Delete-Filter
aushebelt, wäre kein BOLA-Override mehr, sondern eine andere Abfrage unter demselben Namen.
