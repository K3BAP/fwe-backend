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
