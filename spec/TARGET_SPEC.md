# FlightMeet – Target Specification

> **Status:** ✅ **Spezifikation abgeschlossen.** Alle Kapitel geschrieben; **13 ADRs** entschieden
> (`DECISIONS.md`), inkl. Interview-Runde 4 (ADR-012: Schema-/Produkt-Details) und Code-Qualitäts-
> Prinzipien (ADR-013). **Keine blockierenden Fragen** mehr offen; Reste sind TODOs (Webspace-Tests D3,
> Admin-Login D4). **Nächster Schritt: Meilenstein-Planung** für die schrittweise Implementierung.
>
> **Legende:** ✅ bestätigt · 🟡 vorläufig / Vorschlag · ❓OFFEN = Entscheidung des Nutzers nötig

---

## 1. Vision & Zielbild

**FlightMeet** ist eine Community-Plattform für Gleitschirm-Pilotinnen und -Piloten. Sie ermöglicht
es Piloten,

- **Flugtreffen** (gemeinsame Flugtage an einem Spot) zu finden, zu erstellen und sich dafür anzumelden,
- sich in **Gruppen / Communities** zu organisieren (regional, markenbezogen, themenbezogen),
- über ein **app-übergreifendes Chat-System** in Echtzeit zu kommunizieren (Gruppen-, Treffen-,
  Direktnachrichten, öffentliche Feeds),
- sich über **Profile** zu präsentieren und zu vernetzen.

**Projektkontext:** Studierenden-/Uni-Projekt (Modul *fwe*, vermutlich „Fortgeschrittene
Webentwicklung", Uni Trier). Der Funktionsumfang muss in diesem Rahmen realistisch umsetzbar und
technisch sauber sein. **Abgabe** = 8–10 min Präsentation (Aufbau · umgesetzte Funktionen · was war
einfach/schwierig) + Diskussion; ein Teil der Gruppe setzt dieselbe Aufgabe in **Vanilla HTML/JS + CI4**
um. Keine formalen Bewertungskriterien außer der Aufgabe → **saubere, gut lesbare Code-Struktur ist
Top-Priorität** (ADR-013).

---

## 2. Rahmenbedingungen & Tech-Stack (Ist-Zustand)

Diese Fakten stammen aus dem aktuellen Repository-Zustand (nicht verhandelbar, sofern nicht anders entschieden):

### 2.1 Backend
- **CodeIgniter 4.7** (PHP 8.2+) als REST-API. Aktuell frischer `appstarter`, nur Route `/` → `Home`.
- **MySQL** (lokale DB `db_team15`, MAMP Port 8889 / `root`).
- Noch keine Models, Controller (außer `Home`/`BaseController`), Migrations oder Seeds.

### 2.2 Frontend
- **React 19 + Vite 8** SPA im Ordner `frontend/`, gebaut nach `public/`, **same-origin** von
  CI4/Apache ausgeliefert.
- Aktuell **Vanilla JSX** (kein TypeScript). Nur `react`, `react-dom` als Dependencies; `zod` liegt
  bereits in `node_modules`.
- **Noch nicht installiert** (laut Anforderung aber vorgesehen): React Router, Tailwind, DaisyUI,
  Zustand, TanStack Query, Framer Motion, React Hook Form, (Zod).

### 2.3 Build & Deployment
- `composer build:frontend` → `cd frontend && npm run build` (Vite-Build nach `public/`).
- `composer deploy:local` → `rsync` nach `/Applications/MAMP/htdocs/fwe/`.
- `composer deploy:remote` → `lftp`/SFTP auf **geteilten Uni-Webspace**
  `hosting.wi1cm.uni-trier.de` (User `team15`).
- `.deployignore`: `frontend/`-Quellcode wird **nicht** deployed – nur das gebaute `public/` + PHP-Backend.
- Root-`.htaccess` leitet alle Requests nach `/public/` um.

### 2.4 Kritische Plattform-Einschränkung ⚠️
Der geteilte Uni-Webspace erlaubte im Vorgängerprojekt **keine WebSockets / SSE / langlaufenden
Prozesse**. Das steht im direkten Konflikt zur Anforderung „performantes, direktes Chat-System,
**kein Polling**". → **Zentrale Architekturentscheidung** (siehe Kapitel 6 & offene Fragen).
Eine **Supabase**-Integration (gehostete Postgres + Realtime-WebSockets + Auth + Storage) ist in
dieser Session technisch verfügbar und eine mögliche Lösung – aber nicht entschieden.

### 2.5 Sprache
- **Alle nutzer-sichtbaren Strings auf Deutsch** (bestätigt, ADR-012/D1); technische Keys/DB/API/`error.code` Englisch.
- Datums-/Zeitformat `de-DE`.

### 2.6 Code-Qualität (verbindlich, ADR-013)
Lesbarkeit & saubere Struktur sind **gleichrangig zur Funktionalität** (das Ergebnis wird präsentiert und
gegen eine Vanilla-/CI4-Variante verteidigt): **keine Gottklassen**; Backend dünn geschichtet
(Controller → Service → Model); Frontend feature-basiert mit „dummen" Komponenten + Logik in Hooks;
sprechende Namen, DRY, einheitlicher Fehler-Envelope. Meilensteine so schneiden, dass jede Phase
eigenständig lauffähig & reviewbar ist. Details: [`DECISIONS.md`](DECISIONS.md) ADR-013.

---

## 3. Seiten & Navigation (aus Anforderung)

Hauptnavigation mit vier Punkten: **Home · Flugtreffen · Gruppen · Chat** (+ Profil-Zugang).

| Route (🟡 Vorschlag) | Seite | Auth |
|---|---|---|
| `/` | Home: Landing (Gast) **oder** Dashboard (eingeloggt) | öffentlich |
| `/login`, `/register` | Anmeldung / Registrierung | öffentlich |
| `/flugtreffen` | Übersicht (Karte / Tabelle / Cards) | öffentlich lesen (ADR-012/B1) |
| `/flugtreffen/neu` | Flugtreffen erstellen | geschützt |
| `/flugtreffen/:id` | Detailansicht | öffentlich lesen; Aktionen mit Login |
| `/gruppen` | Gruppen-Verzeichnis | öffentlich lesen (ADR-012/B1) |
| `/gruppen/:id` | Gruppendetail (Feed, Channels, Mitglieder) | gemischt (Feed öffentlich) |
| `/chat`, `/chat/:conversationId` | Chat-Bereich | geschützt |
| `/profil/:userId` | Profilseite | öffentlich (reduziert, ADR-012/C2) |

(Endgültige Route-Tabelle: [`spec/05-frontend.md`](05-frontend.md).)

---

## 4. Feature-Kapitel

Detail-Spezifikationen je Domäne und übergreifende Referenzen in eigenen Dateien:

- [`01-auth-profil.md`](01-auth-profil.md) – Authentifizierung & Profile
- [`02-flugtreffen.md`](02-flugtreffen.md) – Flugtreffen (Übersicht, Detail, Erstellen, Teilnahme)
- [`03-gruppen.md`](03-gruppen.md) – Gruppen / Communities, Feeds, Channels
- [`04-chat-realtime.md`](04-chat-realtime.md) – Chat-System & Polling-Realtime
- [`05-frontend.md`](05-frontend.md) – Frontend-Architektur, Routing, State, UX
- [`06-backend-deployment.md`](06-backend-deployment.md) – Backend-/API-Konventionen, Deployment
- [`DATA_MODEL.md`](DATA_MODEL.md) – **vollständiges DB-Schema** (Quelle für Migrations)
- [`API.md`](API.md) – vollständige REST-Endpunkt-Referenz (`/api/v1`)
- [`SEED_DATA.md`](SEED_DATA.md) – Demo-/Seed-Daten inkl. echter Startplatz-Liste
- [`DECISIONS.md`](DECISIONS.md) – Architektur-Entscheidungen (ADR-Log)
- [`OFFENE_FRAGEN.md`](OFFENE_FRAGEN.md) – offene Fragen (lebendes Dokument)
- [`MILESTONES.md`](MILESTONES.md) – Meilensteinplan (M0–M5)
- [`DESIGN_BRIEF.md`](DESIGN_BRIEF.md) – Design-Brief / Prompt für Claude Design
- [`DESIGN.md`](DESIGN.md) – **Design-System** (Tokens + Komponenten aus dem Claude-Design-Entwurf, Quelle fürs M0-Theme); Entwurf unter `design/`

### 4.1 Bestätigte Kern-Anforderungen je Seite (aus der Aufgabenstellung)

> Wörtlich aus der Nutzer-Beschreibung übernommen – Stand „bestätigt", Details folgen je Kapitel.

**Home**
- ✅ Gast: Marketing-Landing-Page mit Plattform-Name, kurzer Beschreibung, Registrieren/Anmelden.
- ✅ Eingeloggt: Dashboard mit aktuellen Flugtreffen und Fliegergruppen (eigene + Vorschläge).

**Flugtreffen-Übersicht**
- ✅ Mehrere Ansichten: Karte (Leaflet o.ä.) / Tabelle / Dashboard-Cards.
- ✅ Datenfelder: Titel, Flugspot, Region, Datum, Uhrzeit, Erfahrungslevel, angemeldete Teilnehmer,
  max. Teilnehmerzahl, Status.
- ✅ Suche über Titel, Flugspot, Region, Beschreibung. Filter mind. nach Region und Erfahrungslevel.

**Flugtreffen-Detail**
- ✅ Anzeige: Titel, Flugspot, Region, Datum, Uhrzeit, Beschreibung, Erfahrungslevel, Teilnehmerliste,
  freie Plätze, Buttons „Teilnehmen" und „Zurück".
- ✅ „Teilnehmen": Teilnehmerzahl steigt, eigener Eintrag erscheint in der Liste, Button wechselt zu
  „Absagen", Erfolgs-Toast. Bei vollem Treffen keine Teilnahme mehr möglich.

**Flugtreffen erstellen**
- ✅ Formular/Wizard mit: Titel, Flugspot, Region, Datum, Uhrzeit, Erfahrungslevel,
  max. Teilnehmerzahl, Beschreibung.

**Gruppen**
- ✅ Communities gründen; Austausch über (mehrere, themenbasierte) Chats/Channels.
- ✅ Öffentlicher Feed je Gruppe; Admins posten; auch für Nicht-Mitglieder einsehbar.
- ✅ Frei zugängliche **und** private Gruppen (Einladung oder Bewerbung).

**Chat**
- ✅ Globales, app-übergreifendes Chat-System; performant & direkt (kein Polling angestrebt).
- ✅ Einsatzorte: Gruppen-Channels, Flugtreffen-Chats, Direktnachrichten, ggf. öffentliche Feeds.
- ✅ In Flugtreffen-Chats: Nachrichten des Erstellers hervorgehoben.

**Profil**
- ✅ Mind. Profilbild, Name, Bio. Bio „hübsch gestaltbar" (evtl. Markdown).
- ✅ Anklickbare Profilkarte (Popover) überall, von der aus direkt ein Privatchat startbar ist.

---

## 5. Architektur-Übersicht (🟡 Vorschlag aus der Analyse – noch zu bestätigen)

Leitprinzip aus der Domänenanalyse (Konsens aller technischen Domänen):

> **MySQL ist die alleinige Source of Truth. Realtime ist ein austauschbarer Transport-Layer
> obendrauf, mit verpflichtendem Polling-Fallback.** So bleibt das System demofähig, auch wenn ein
> Drittanbieter ausfällt, und unabhängig von der WebSocket-Untauglichkeit des Webspaces.

```
┌──────────────────────────────────────────────────────────────┐
│  React 19 SPA (frontend/ → public/)                          │
│  React Router · TanStack Query (Server-State) · Zustand (UI) │
│  Tailwind+DaisyUI · Framer Motion · RHF+Zod                  │
└───────────────┬───────────────────────────┬──────────────────┘
                │ REST /api/v1 (Bearer/Cookie)│ Realtime-Events (optional)
                ▼                             ▼
┌──────────────────────────────┐   ┌───────────────────────────┐
│  CodeIgniter 4.7 REST-API    │   │  Realtime-Transport         │
│  Auth-Filter + BOLA-Autoris. │──▶│  (Pusher/Ably | Supabase |  │
│  Controller · Models         │   │   Polling-Fallback)         │
└───────────────┬──────────────┘   └───────────────────────────┘
                ▼
┌──────────────────────────────┐
│  MySQL db_team15 (SoT)       │
│  users · meetups · groups ·  │
│  conversations · messages …  │
└──────────────────────────────┘
```

**Getroffene Grundsatzentscheidungen** (Details & Begründung in [`DECISIONS.md`](DECISIONS.md)):
- ✅ **Realtime:** **Pragmatisches Polling** über die CI4/MySQL-REST-API (TanStack Query,
  gestaffelte Intervalle, `?since=`/ETag/304). Kein externer Dienst, MySQL = alleinige SoT. `ADR-001`
- ✅ **Deployment:** Uni-Webspace, **nur SFTP**. Migrations lokal = Wahrheit, **SQL-Dump per
  phpMyAdmin** für Prod. Kein Cron → abgeleitete Zustände im Read-Pfad. `ADR-002`
- ✅ **TypeScript:** jetzt voll einführen; Zod-`z.infer` als Typ-SoT über die API-Grenze. `ADR-003`
- ✅ **Auth:** **CI4 + CodeIgniter Shield**, alleinige Identitätsquelle, kein Supabase; **Shield
  Session-Authenticator (HttpOnly-Cookie)**. `ADR-004`
- ✅ **Chat:** **eine** polymorphe Engine (`conversations`/`conversation_participants`/`messages`) für
  alle Chat-Orte. `ADR-005`
- 🟡 **Enums:** deutsche Labels, **englische** technische Keys (DB-Spalten, API-Felder, `error.code`).

---

## 6. Architekturentscheidungen (alle entschieden ✅)

Alle blockierenden Weichen sind entschieden — vollständige Begründungen in [`DECISIONS.md`](DECISIONS.md)
(ADR-001…013), Protokoll der 80 Detailfragen in [`OFFENE_FRAGEN.md`](OFFENE_FRAGEN.md). Die zentralen Weichen:

1. **Realtime-Chat-Strategie** (externer Dienst vs. Polling) – folgenschwerste Entscheidung.
2. **Deployment-Ziel & SSH-Zugang** (gated die Realtime-Frage).
3. **Gemeinsame polymorphe Chat-Engine** vs. getrennte Tabellen.
4. **Auth-Stack** (CI4-only; Shield vs. Eigenbau) und **Token-Speicherung** (localStorage vs. Cookie).
5. **TypeScript** jetzt einführen?
6. **Gruppen-Sichtbarkeitsmodell** (zwei Achsen `visibility`+`join_policy`).
7. **Geo-Daten für Flugtreffen** (kuratierte `spots`-Tabelle) + Verantwortlicher für Seed-Daten.

---

## 7. Querschnittsthemen (domänenübergreifend zu lösen)

- **Generische Chat-Engine** – einmal bauen, von Gruppen/Treffen/DMs genutzt. Ersteller-Hervorhebung
  ist eine reine Render-Regel (`sender_id == context.creator_id`), kein DB-Feld.
- **Serverseitige Autorisierung (BOLA-Schutz)** – Routing-Gates im Frontend sind nur UX; jeder
  `/api`-Endpoint braucht Auth-Filter **plus** Objekt-Autorisierung gegen `*_members`/`*_participants`.
- **Datei-Uploads** – öffentliche Bilder nach `public/media/uploads/` (außerhalb des Vite-Builds),
  MIME-Whitelist, Größenlimit, EXIF strippen, GD-Resize, randomisierte Dateinamen.
- **Abgeleitete Zustände ohne Cron** – `voll`/`abgeschlossen` etc. im Read-Pfad berechnen (kein
  zuverlässiger Cronjob auf dem Webspace).
- **Race-Conditions** – `UNIQUE`-Constraints + Transaktionen (Teilnahme, DM-Anlage, Mitgliedschaft).
- **Migrations als Wahrheit, SQL-Dump für Prod** (falls kein SSH → Import per phpMyAdmin).

## 8. Identifizierte Lücken (in der Aufgabenstellung nicht adressiert)

Benachrichtigungen/Notification-Center · DSGVO & Impressum (DE-Pflicht) · globales Melde-/
Moderationssystem · Teststrategie (phpunit/Vitest) · Barrierefreiheit · Onboarding & Empty-States ·
globale Suche & @-Mentions · Verantwortlicher für Geo-Seed-Daten · Audit-Logging ·
Last-Budget des geteilten Hosts. → Details in [`spec/OFFENE_FRAGEN.md`](OFFENE_FRAGEN.md).

---

## 9. Meilensteine

Vollständiger Plan in [`MILESTONES.md`](MILESTONES.md). **Prototyp-zuerst** (ADR-016): erst die komplette
UI mit Mock-Daten, dann domänenweise verkabeln. Jede Phase eigenständig lauffähig & reviewbar (ADR-013):

| MS | Titel | Ergebnis |
|---|---|---|
| **M0** | Fundament & **Design-System** | Theme + Fonts + Komponentenbibliothek (aus dem Design-Entwurf), Styleguide |
| **M1** | **UI-Prototyp (komplett, Mock)** | Alle Screens navigierbar mit Mock-Daten — klickbare Demo |
| **M2** | Backend-Fundament & **Auth** | CI4/Shield, Migrations, `/api/v1`; Auth/Profile echt |
| **M3** | **Flugtreffen** verkabeln | spots-Seed, Karte/Liste/Cards, Teilnahme echt |
| **M4** | **Gruppen** verkabeln | Rollen, Beitritt, Feed echt |
| **M5** | **Chat & Benachrichtigungen** verkabeln | polymorphe Engine, Polling echt |
| **M6** | Politur, Seed, Tests, **Deploy** | Demo-Daten, a11y, Tests, Webspace |

---

## 10. Änderungshistorie

| Datum | Änderung |
|---|---|
| 2026-06-18 | Erstentwurf: Projektkontext, bestätigte Anforderungen, Struktur angelegt. |
| 2026-06-18 | Domänenanalyse (6 Architekten) → 80 offene Fragen erfasst. ADR-001…004 entschieden (Polling, SFTP/SQL-Dump, TypeScript, Shield). |
| 2026-06-19 | Interview-Runden 2+3: ADR-005…011 (Session-Cookie, polymorphe Chat-Engine, Gruppen 2-Achsen, Spots, Scope, Chat-MVP, Profil, Bio). Erster vollständiger Entwurf: `DATA_MODEL.md`, Kapitel `01–06`, `API.md`, `SEED_DATA.md` geschrieben. Interview-Runde 4 vorbereitet. |
| 2026-06-19 | Interview-Runde 4: **ADR-012** (Gruppe A–D: Schema-Detail- & Produktentscheidungen) + **ADR-013** (Code-Qualität verbindlich). Alle `❓OFFEN`-Detailmarker in den Kapiteln aufgelöst, `DATA_MODEL.md` reconciliert (u.a. `messages.updated_at`, `meetup_uniq`, `feed_post_reactions`, `users.id`=BIGINT). **Spezifikation abgeschlossen.** |
| 2026-06-19 | Spec-Durchgang (Datenmodell & Chat-Engine): **ADR-014** — einfache Replies im Chat-MVP (`reply_to_id`), verwaiste Konversationen via Service+Tests. |
| 2026-06-19 | Spec-Durchgang (Rest des Datenmodells): **ADR-015** — keine Warteliste (voll ⇒ 409), Organisator zählt mit, `meetup_participants` schlank (kein `role`/`status`), `@handle` bestätigt. Versteckter `❓**OFFEN`-Marker in Kapitel 02 aufgelöst. |
| 2026-06-19 | Spec-Durchgang (Auth & Profile): Profil-Sichtbarkeit auf ADR-012/B1+C2 ausgerichtet (öffentlich lesbar, reduzierte Projektion für Gäste) in Kap. 01 + API.md; Pfad vereinheitlicht auf `/users/{id}` (statt `/profiles/{userId}`) in API.md + Kap. 06. |
| 2026-06-19 | Spec committet (`76ed97c`). Meilensteinplan `MILESTONES.md` (M0–M5) erstellt. |
| 2026-06-19 | Design-Richtung festgelegt (abenteuerlich-sportlich · Himmelblau + Sonnenuntergang · großzügig · Komoot/Strava). `DESIGN_BRIEF.md` (Claude-Design-Prompt) erstellt. |
| 2026-06-19 | **ADR-016**: Umstellung auf **Prototyp-zuerst** (Claude-Design-Entwurf liegt vor). `MILESTONES.md` neu strukturiert (M0 Design-System → M1 UI-Prototyp → M2–M5 verkabeln → M6 Deploy). |
| 2026-06-25 | Claude-Design-Entwurf importiert (Design System + Prototyp unter `design/`). Tokens als `DESIGN.md` extrahiert (inkl. DaisyUI-Theme-Mapping Light/Dark). |
