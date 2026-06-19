# FlightMeet – Meilensteinplan

Schrittweise Implementierung in **eigenständig lauffähige, reviewbare Phasen** (ADR-013). Jeder
Meilenstein endet mit einem Stand, den man starten, durchklicken und reviewen kann — kein „großer
Knall" am Ende. Wo möglich **vertikale Slices** (DB → API → UI für ein Feature), statt schichtweise.

> **Bezug:** Architektur & Entscheidungen in [`DECISIONS.md`](DECISIONS.md), Schema in
> [`DATA_MODEL.md`](DATA_MODEL.md), Endpunkte in [`API.md`](API.md), Feature-Details in `01–06`.

## Überblick

| MS | Titel | Ergebnis (Demo-fähig) |
|---|---|---|
| **M0** | Fundament & Gerüst | App startet, Landing + Navigation, `/api/v1` antwortet, Build deployt |
| **M1** | Auth & Profile | Registrieren/Login/Logout, Profil + Profilkarte, Dashboard-Gerüst |
| **M2** | Flugtreffen | Treffen finden (Karte/Tabelle/Cards), erstellen, teilnehmen/absagen |
| **M3** | Gruppen | Gruppen gründen/finden, Rollen, Beitritt, öffentlicher Feed |
| **M4** | Chat & Benachrichtigungen | Channels-, Treffen-, Direkt-Chat (Polling) + Notification-Center |
| **M5** | Politur, Seed, Tests, Deploy | Demo-Daten, Transitions, a11y, Tests, Prod-Deploy auf den Webspace |

Reihenfolge ist durch Abhängigkeiten bestimmt: **M0 → M1** sind Pflicht-Fundament; **M2/M3** bauen auf
M1 auf (parallelisierbar); **M4** braucht M1 (User) + M2/M3 (Kontexte für Channels/Treffen-Chat); **M5**
schließt ab.

---

## M0 – Fundament & Gerüst

**Ziel:** Lauffähige leere App auf beiden Stacks; alle Querschnitts-Bausteine stehen, sodass Features ab
M1 nur noch „eingehängt" werden.

**Backend (CI4):**
- `composer require codeigniter4/shield`; Shield-Setup; **Migration, die `users.id` auf `BIGINT UNSIGNED` anhebt** (ADR-012/A1) **vor** allen abhängigen Tabellen.
- `/api/v1`-Routing-Gruppe, `autoRoutes=false` (Kap. 06 §2); `BaseApiController` mit Envelope-Helfern + globaler Exception-Handler (`internal_error`, kein Stacktrace-Leak).
- Filter: `auth` (Shield-Session → JSON-401), `csrf`, `throttle`; `GET /api/v1/health` als Smoke-Test.
- `.env`-Trennung (lokal/Prod), DB-Verbindung, FileCache (Fallback „kein Cache").

**Frontend (React/Vite):**
- **TypeScript-Umstellung** (`.tsx`, `tsconfig`, typescript-eslint), Zod im Stack.
- Tailwind + DaisyUI (FlightMeet-Theme: Himmel/Gleitschirm-Farbwelt, Dark-Mode via `UiStore.theme`).
- React Router-Gerüst (Layout-Route, 404, History-Fallback, `basename` aus `BASE_URL`), Bottom-Nav (Home/Flugtreffen/Gruppen/Chat).
- Provider: TanStack Query, Zustand-Stores (`AuthStore`, `UiStore`), Toaster.
- **`fetch`-Client** (`credentials:'include'`, CSRF-Header, Envelope-/`error.code`-Mapping, 401-Interceptor).
- **Marketing-Landing-Page** (Gast) als erste echte Seite.

**Abhängigkeiten:** keine. **ADR:** 001, 002, 003, 004, 013.

**Akzeptanz / Review:** App startet lokal (`npm run dev` + CI4) **und** als gebauter `public/`-Stand;
Landing rendert; `GET /api/v1/health` → `200` Envelope; Dark-Mode toggelt; Lint/TS grün;
`composer build:frontend` + `deploy:local` funktionieren.

---

## M1 – Auth & Profile

**Ziel:** Vollständiger Anmelde-Lebenszyklus + Profile + die überall genutzte Profilkarte.

**Backend:** `profiles`-Migration (+ vorbereitete deferred Spalten); `AuthController` (register/login/
logout/me, CSRF-Bootstrap, Throttle); `ProfileController` (`/me/profile` GET/PATCH, **öffentliches**
`/users/{id}` mit reduzierter Projektion ADR-012/B1+C2, `/users/handle/{h}`, `/users`-Suche auth);
`UploadController` (Avatar: MIME-Whitelist, GD-Resize, EXIF-Strip, randomisierter Name → `public/media/uploads/avatars/`);
Konto-Soft-Delete/Anonymisierung; Admin-Group-Seed; **BOLA-Helfer** (`authorizeOwner`) etabliert.

**Frontend:** Register-/Login-Formulare (RHF+Zod), `ProtectedRoute`, Auth-Gate (Landing vs. Dashboard),
Profilseite + Profil-Edit, **`<BioMarkdown>`** (react-markdown ohne rehype-raw + sanitize) und
**`<UserCard>`**-Hovercard (gecacht, „Direktchat öffnen"-Button als Platzhalter bis M4),
Dashboard-Gerüst mit Empty-States.

**Abhängigkeiten:** M0. **ADR:** 004, 010, 011, 012 (B1/C2/C1), 013.

**Akzeptanz / Review:** Registrieren → eingeloggt → Dashboard; Logout; `/auth/me`-Gate ohne Redirect-Loop;
Profil bearbeiten inkl. Avatar-Upload + Bio-Markdown (XSS-Probe neutralisiert); öffentliches Profil als
Gast reduziert, eingeloggt voll; Profilkarte erscheint per Hover/Tap; Konto-Löschung anonymisiert ohne
404 auf Referenzen. BOLA: fremdes Profil patchen ⇒ `403`.

---

## M2 – Flugtreffen

**Ziel:** Treffen-Domäne end-to-end (das „Schaufenster" der App).

**Backend:** `spots` (+ **Seed ~20–30 reale Startplätze**, [`SEED_DATA.md`](SEED_DATA.md)); `meetups` +
`meetup_participants` (schlank, ADR-015); `MeetupController` (index mit Suche/Filter/Sortier/Pagination,
show mit **abgeleitetem Status** + `participant_count`/`free_spots`, create, update/cancel mit
Ersteller-/Admin-Rechten, **join/leave als Transaktion** + `UNIQUE` + `409 meetup_full`, Ersteller wird
auto-eingetragen & zählt mit); `GET /spots` (öffentlich, cachebar, read-only).

**Frontend:** Übersicht mit **drei umschaltbaren Ansichten** — Leaflet-Karte (OSM, Marker aus
`spot.lat/lng`), Tabelle, Dashboard-Cards; Such-/Filterleiste (Region, Erfahrungslevel, Datum);
Detailseite mit Teilnehmerliste (Ersteller zuerst); **Teilnehmen/Absagen** mit Optimistic Update + Toast
+ Rollback bei `409`; **Erstellen-Wizard** (RHF+Zod, Spot-Autocomplete).

**Abhängigkeiten:** M1 (eingeloggte Aktionen, Teilnehmer = User). **ADR:** 007, 012 (A3/A4/B5), 015.

**Akzeptanz / Review:** Treffen anlegen → erscheint in allen drei Ansichten + auf der Karte; Suche/Filter
wirken serverseitig; Teilnehmen erhöht Zähler & wechselt Button; volles Treffen blockiert (`409`);
zwei gleichzeitige Beitritte auf letzten Platz → genau einer gewinnt; vergangenes Treffen = `finished`.

---

## M3 – Gruppen

**Ziel:** Communities mit Rollen, Beitrittswegen und öffentlichem Feed (Channels-Chat folgt in M4).

**Backend:** `groups` (visibility×join_policy), `group_members` (Rollen/Ban), `group_join_requests`,
`group_invites` (Token/`max_uses`), `feed_posts` + `feed_post_reactions`; Controller für CRUD, Beitritt
(open/request/invite), Antrags-/Einladungsverwaltung, Feed (Admin-Post + Emoji-Reaktion); **Default-
Channel „Allgemein"** wird bei Gruppen-Erstellung als `conversations(type=group_channel)` angelegt
(Engine-Vorgriff, Schreiben erst M4); Owner-Transfer-Invariante.

**Frontend:** Gruppen-Verzeichnis + Suche + Dashboard-Vorschläge; Gruppendetail (Feed öffentlich,
Mitglieder, Channel-Liste als Platzhalter); Beitritts-/Antrags-/Einladungs-UI; Gruppe anlegen (RHF+Zod,
Logo-Upload); Admin-Moderationsaktionen (Mitglied entfernen, Post soft-löschen).

**Abhängigkeiten:** M1; nutzt Upload (M1) & UserCard. **ADR:** 005 (Channel=Conversation), 006, 008, 012 (B2/B3/B4/C3/C4).

**Akzeptanz / Review:** öffentliche/private/unlisted Verhalten stimmt mit der Matrix (Kap. 03) überein;
Beitritt je `join_policy`; Antrag genehmigen/ablehnen; Einladungs-Token tritt bei; Feed für Gäste sichtbar
(außer `private`), Reaktion nur eingeloggt; letzter Owner kann nicht ohne Transfer austreten.

---

## M4 – Chat & Benachrichtigungen

**Ziel:** Die polymorphe Chat-Engine über **alle** Orte + In-App-Benachrichtigungen, via Polling.

**Backend:** `conversations`/`conversation_participants`/`messages`/`message_reactions` (+ `meetup_uniq`,
`messages.updated_at`); `ConversationController` (Liste, **DM find-or-create** `dm_key`, markRead),
`MessageController` (index Keyset + **`?since=`/`updated_at`-Delta** + **ETag/304**, create inkl.
`reply_to_id`, soft-edit **15-min-Fenster**, soft-delete/Tombstone), `ReactionController` (toggle);
Channel-Erstellung in Gruppen; **BOLA pro Konversation** gegen `conversation_participants`;
`notifications` + `unread-count` (schlank); Aufräum-Logik verwaister Konversationen (Service + Tests).

**Frontend:** Chat-Bereich (Konversationsliste + Verlauf), **gestaffeltes Polling** (aktiv 2–3 s, Listen
15–30 s, Pause bei `document.hidden`), `queryClient.setQueryData`-Merge; Senden, Reaktionen, Edit/Delete,
**Reply mit Zitat-Vorschau**, Ersteller-Hervorhebung im Treffen-Chat; „Direktchat öffnen" aus der
Profilkarte wird scharf geschaltet; Treffen- und Gruppen-Channels-Chat eingebunden; **Notification-
Center** + globaler Badge (`notificationCopy.ts`-Map, ADR-012/C8).

**Abhängigkeiten:** M1 (User/UserCard), M2 (Treffen-Chat-Kontext), M3 (Channels-Kontext). **ADR:** 001, 005, 008, 009, 012 (A2/A3/C5/C6/C7/C8), 014.

**Akzeptanz / Review:** Nachricht erscheint beim Gegenüber in ~2–3 s; Edit/Reaktion/Delete kommen über
das `updated_at`-Delta live an; Ungelesen-Zähler & Badge stimmen; DM ist idempotent (kein Duplikat);
genau eine Konversation pro Treffen; Schreiben ohne Mitgliedschaft ⇒ `403`; gelöschte Nachricht als
Tombstone; Polling pausiert bei verstecktem Tab.

---

## M5 – Politur, Seed, Tests & Deploy

**Ziel:** Demo-reif und auf dem Uni-Webspace lauffähig.

- **Seed/Demo-Daten** vollständig ([`SEED_DATA.md`](SEED_DATA.md)): Piloten, Spots, Treffen (Zukunft/
  Vergangenheit/abgesagt), Gruppen mit Channels+Feed, Beispiel-Chats, Notifications, Demo-Logins.
- **UX-Politur:** Framer-Motion-Transitions (Seitenwechsel, Modals, Toasts, Karten-Marker), Skeletons,
  konsequente Lade-/Empty-/Error-States, responsive/Mobile-Bottom-Nav-Feinschliff.
- **Barrierefreiheit:** Tastatur/Fokus in Modals/Drawer/Chat, ARIA-Live für neue Nachrichten, Kontraste.
- **Tests:** phpunit-Feature-Tests (Auth, BOLA, Teilnahme-Race, DM-Unique, Chat-Delta); optional Vitest
  für Kern-Komponenten.
- **Deploy:** deterministischer **SQL-Dump → phpMyAdmin**; `composer build:frontend` → `deploy:remote`;
  **Webspace-TODOs (ADR-012/D3):** SMTP/Schreibrechte/Quota für `public/media/uploads/`, `ETag`/`304`
  durchgereicht? Upload-Verzeichnis-Schutz. **D4:** finaler Admin-Login.
- **Abnahme-Vorbereitung:** 8–10-min-Präsentation (Aufbau · Funktionen · einfach/schwierig).

**Abhängigkeiten:** M1–M4. **ADR:** 002, 008, 012 (D3/D4), 013.

**Akzeptanz / Review:** Frischer DB-Dump + Build laufen auf dem Webspace; Demo-Login zeigt sofort
gefüllte Oberflächen; Tests grün; Lighthouse/a11y-Basischeck ok.

---

## Querschnitt (früh etabliert, durchgängig genutzt)

- **Envelope + `error.code`-Mapping** (M0) → jedes Feature nutzt dieselben Helfer.
- **BOLA-Autorisierungs-Helfer** (M1) → in jeder schreibenden Aktion.
- **Upload-Pipeline** (M1) → Avatar, dann Gruppen-Logo (M3), Feed-Bild (M3).
- **`<UserCard>` / `<BioMarkdown>`** (M1) → überall, kapseln Sanitizing.
- **Polling-/Query-Konventionen** (M4) → einheitliche Intervalle/Keys.

## Offene TODOs (kein Blocker, in M5 verortet)
- **D3:** Webspace-Praxistest (SMTP, Schreibrechte/Quota, ETag/304).
- **D4:** finaler Admin-Login für die Abnahme.
