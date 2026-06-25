# FlightMeet – Meilensteinplan (Prototyp-zuerst)

Strategie: **erst die komplette UI als klickbarer Prototyp, dann domänenweise mit echter Funktionalität
füllen** (ADR-016). Möglich, weil **Datenmodell & API-DTOs bereits feststehen** ([`DATA_MODEL.md`](DATA_MODEL.md),
[`API.md`](API.md)) — der Prototyp nutzt **typisierte Mock-Daten, die den echten Response-Shapes
entsprechen**. Jede Phase ist eigenständig lauffähig & reviewbar (ADR-013).

> **Die Naht, die alles trägt:** Ein **Daten-Zugriffs-Layer** (typisierte TanStack-Query-Hooks +
> `fetch`-Client) gibt **DTOs** zurück. In M1 liefern diese Hooks **Mocks**; ab M2 wird pro Domäne nur
> die Implementierung hinter der Naht von Mock auf echtes `fetch` umgestellt — UI-Komponenten bleiben
> unverändert. So ist „Prototyp zuerst" risikoarm.

## Überblick

| MS | Titel | Ergebnis (Demo-fähig) |
|---|---|---|
| **M0** | Fundament & **Design-System** | Theme + Fonts + Basis-Komponentenbibliothek (aus dem Claude-Design-Entwurf), Styleguide-Route |
| **M1** | **UI-Prototyp (komplett, Mock)** | Alle Screens navigierbar mit Mock-Daten — klickbare Frontend-Demo |
| **M2** | Backend-Fundament & **Auth** | CI4/Shield, Migrations, `/api/v1`; Auth/Profile echt verkabelt |
| **M3** | **Flugtreffen** verkabeln | spots-Seed, Karte/Liste/Cards, Teilnahme echt |
| **M4** | **Gruppen** verkabeln | Rollen, Beitritt, Feed echt |
| **M5** | **Chat & Benachrichtigungen** verkabeln | polymorphe Engine, Polling echt |
| **M6** | Politur, Seed, Tests, **Deploy** | Demo-Daten, Transitions, a11y, Tests, Webspace |

**Logik:** M0→M1 = sichtbare UI. M2 baut das Backend-Fundament + verkabelt die erste Domäne (Auth) und
etabliert das Mock→Real-Muster. M3/M4/M5 wiederholen das Muster je Domäne (parallelisierbar nach M2).
M6 schließt ab.

---

## M0 – Fundament & Design-System

**Ziel:** Stack steht; das **Design-System aus dem Claude-Design-Entwurf** ist als DaisyUI-Theme +
wiederverwendbare Komponentenbibliothek umgesetzt. Referenz: [`DESIGN.md`](DESIGN.md) / [`DESIGN_BRIEF.md`](DESIGN_BRIEF.md).

- **Stack:** TypeScript-Umstellung (`.tsx`, `tsconfig`, typescript-eslint, Zod); **Tailwind + DaisyUI**.
- **Design-Tokens → DaisyUI-Theme:** Farben (Himmelblau/Sonnenuntergang, Light **und** Dark), Radien,
  Schatten, Spacing, Typo aus dem Entwurf in `tailwind.config` + DaisyUI-Custom-Theme; **Fonts** (Headings
  + Body) einbinden; globale CSS-Basis. `spec/05-frontend.md` „Branding" wird damit konkret.
- **Basis-Komponentenbibliothek** (1:1 zum Design-System, ADR-013, kapselt DaisyUI): `Button`, `Card`,
  `Badge`/`Chip` (Erfahrungslevel, Status, Region), `Input`/`Select`/`Textarea`, `Avatar`, `UserCard`-
  Hülle, `AppShell` (Sticky-Header **ohne** Content-Überlappung + mobile **Bottom-Nav**), `Modal`/`Drawer`,
  `Toast`, `EmptyState`, `Skeleton`, `MapShell` (Leaflet-Wrapper).
- **Styleguide-Route** (`/styleguide`, nur Dev/intern): zeigt alle Komponenten + Tokens — lebende Referenz
  und starkes Präsentations-Artefakt.
- Provider: TanStack Query, Zustand (`AuthStore`/`UiStore`), Toaster; `ThemeProvider` (Light/Dark).

**Abhängigkeiten:** keine. **ADR:** 003, 011, 013, 016 + Design-Tokens aus dem Entwurf.

**Akzeptanz / Review:** Styleguide rendert alle Komponenten in Light & Dark **passend zum Entwurf**;
Header überlagert nie Inhalt; mobile Bottom-Nav korrekt; Lint/TS grün; Build deployt.

---

## M1 – UI-Prototyp (komplett, Mock-Daten)

**Ziel:** Die **gesamte Oberfläche** als navigierbarer Prototyp — visuell fertig, ohne Backend.

- **Daten-Zugriffs-Naht:** `src/types/` mit **Zod-Schemas/`z.infer`-DTOs** exakt nach [`API.md`](API.md);
  `src/api/` mit typisierten **Query/Mutation-Hooks**, die in M1 aus `src/mocks/` bedient werden
  (realistische deutsche Mock-Daten: echte Spots, Treffen, Gruppen, Chats). Künstliche Latenz/Empty/Error-
  Schalter zum Durchspielen der Zustände.
- **Routing & Screens** (alle aus [`05-frontend.md`](05-frontend.md) / Prototyp):
  - Landing (Gast), Login/Register (Formular-UI, RHF+Zod-Validierung, kein echter Submit)
  - Dashboard (eigene/empfohlene Treffen + Gruppen)
  - Flugtreffen: Übersicht mit **Cards/Tabelle/Karte**-Umschalter, Suche/Filter (auf Mock-Daten),
    Detailseite (Teilnahme-Toggle auf Mock-State + Toast), Erstellen-Wizard
  - Gruppen: Verzeichnis, Gruppendetail (Feed + Reaktionen, Channel-Liste, Mitglieder)
  - Chat: Konversationsliste + Verlauf (Channels/Treffen/DM), Ersteller-Hervorhebung, Reaktion/Reply-UI
  - Profil + **Profilkarte-Popover**, Notification-Center
  - Durchgängige **Lade-/Empty-/Error-States** + Skeletons; Framer-Motion-Grundtransitions
- **Pure-UI-Interaktionen** funktionieren (View-Umschalter, Modals, Filter, optimistische Toggles auf
  Mock-State); nichts trifft ein Backend.

**Abhängigkeiten:** M0. **ADR:** 005/006/009/012/014/015 (als UI/DTO-Form), 016.

**Akzeptanz / Review:** Jeder Screen ist erreichbar und entspricht dem Entwurf; alle Zustände
(leer/laden/Fehler/voll) durchspielbar; Mobile + Desktop sauber; **DTO-Typen = `API.md`** (spätere
Verkabelung ist nur Implementierungstausch).

---

## M2 – Backend-Fundament & Auth verkabeln

**Ziel:** Backend steht; das **Mock→Real-Muster** ist etabliert und an Auth/Profile bewiesen.

- **Backend:** `composer require codeigniter4/shield`; **Migration `users.id`→`BIGINT UNSIGNED`**
  (ADR-012/A1) vor abhängigen Tabellen; `/api/v1`-Routing, `BaseApiController` (Envelope), Filter
  (`auth`/`csrf`/`throttle`), globaler Exception-Handler; `profiles`-Migration; **BOLA-Helfer**;
  Auth- + Profile-Controller; Avatar-Upload.
- **Frontend:** Auth/Profile-Hooks von Mock auf echtes `fetch` umstellen (`credentials:'include'`, CSRF);
  `ProtectedRoute` wird scharf; `AuthStore` aus echtem `['me']`; Login/Register/Logout real; Profil-Edit +
  Avatar real; Profilkarte „Direktchat öffnen" bleibt Mock bis M5.

**Abhängigkeiten:** M0, M1. **ADR:** 002, 004, 010, 011, 012 (A1/B1/C2), 013.

**Akzeptanz / Review:** Registrieren→eingeloggt→Dashboard (echt); `403` bei fremdem Profil (BOLA);
Avatar-Upload; XSS-Probe in Bio neutralisiert; UI unverändert ggü. M1 (nur Datenquelle echt).

---

## M3 – Flugtreffen verkabeln

**Backend:** `spots` (+ **Seed ~20–30 reale Startplätze**, [`SEED_DATA.md`](SEED_DATA.md)), `meetups` +
`meetup_participants` (schlank, ADR-015), `MeetupController` (Suche/Filter/Pagination, abgeleiteter
Status, **join/leave-Transaktion** + `409`, Ersteller zählt mit), `GET /spots` öffentlich.
**Frontend:** Flugtreffen-Hooks Mock→Real; Leaflet mit echten `spot.lat/lng`; Teilnahme echt (Optimistic
+ Rollback bei `409`); Wizard schreibt echt.
**Abhängigkeiten:** M2. **ADR:** 007, 012 (A3/A4/B5), 015.
**Akzeptanz:** Treffen anlegen→in allen drei Ansichten + Karte; volles Treffen `409`; Race → genau einer gewinnt.

---

## M4 – Gruppen verkabeln

**Backend:** `groups` (visibility×join_policy), `group_members`, `group_join_requests`, `group_invites`,
`feed_posts` + `feed_post_reactions`; Beitritt/Antrag/Invite, Feed, Default-Channel-Anlage.
**Frontend:** Gruppen-Hooks Mock→Real; Beitritts-/Antrags-/Invite-UI echt; Feed + Reaktionen echt.
**Abhängigkeiten:** M2. **ADR:** 005, 006, 008, 012 (B2/B3/B4/C3/C4).
**Akzeptanz:** Matrix-Verhalten (Kap. 03) stimmt; Antrag genehmigen; Invite-Token tritt bei; Owner-Transfer-Invariante.

---

## M5 – Chat & Benachrichtigungen verkabeln

**Backend:** polymorphe Engine (`conversations`/`participants`/`messages`/`reactions`, `meetup_uniq`,
`messages.updated_at`); DM find-or-create; Keyset + `?since=`/`updated_at`-Delta + ETag/304; Reaktion/
Reply/Soft-Edit(15min)/Delete; BOLA pro Konversation; `notifications` + `unread-count`; Aufräum-Logik (Tests).
**Frontend:** Chat-Hooks Mock→Real; **gestaffeltes Polling** (2–3 s aktiv, 15–30 s Listen, Pause bei
`document.hidden`); `setQueryData`-Merge; „Direktchat öffnen" scharf; Notification-Center + Badge echt.
**Abhängigkeiten:** M2 (User), M3 (Treffen-Chat), M4 (Channels). **ADR:** 001, 005, 008, 009, 012 (A2/A3/C5/C6/C7/C8), 014.
**Akzeptanz:** Nachricht in ~2–3 s beim Gegenüber; Edit/Reaktion/Delete via `updated_at`-Delta; Ungelesen/Badge stimmen; DM idempotent; `403` ohne Mitgliedschaft.

---

## M6 – Politur, Seed, Tests & Deploy

- **Seed/Demo-Daten** vollständig ([`SEED_DATA.md`](SEED_DATA.md)); **Framer-Motion**-Feinschliff;
  a11y-Pass (Fokus/ARIA-Live/Kontraste); responsive/Mobile-Feinschliff.
- **Tests:** phpunit-Feature-Tests (Auth, BOLA, Teilnahme-Race, DM-Unique, Chat-Delta); optional Vitest.
- **Deploy:** SQL-Dump→phpMyAdmin; `composer build:frontend`→`deploy:remote`; **TODOs D3** (SMTP/Quota/
  ETag testen) **+ D4** (Admin-Login). Abnahme-Präsentation vorbereiten.
- **Abhängigkeiten:** M1–M5. **ADR:** 002, 008, 012 (D3/D4), 013.
- **Akzeptanz:** frischer Dump + Build laufen auf dem Webspace; Demo-Login zeigt gefüllte Oberflächen; Tests grün.

---

## Querschnitt (früh etabliert, durchgängig genutzt)
- **Design-Tokens + Komponentenbibliothek** (M0) → jeder Screen nutzt dieselben Bausteine.
- **Daten-Zugriffs-Naht (DTO-Typen + Hooks)** (M1) → in M2–M5 nur die Implementierung getauscht.
- **Envelope + BOLA-Helfer + Upload-Pipeline** (M2) → in allen Domänen wiederverwendet.

## Offene TODOs (kein Blocker, in M6 verortet)
- **D3:** Webspace-Praxistest (SMTP, Schreibrechte/Quota, ETag/304).
- **D4:** finaler Admin-Login für die Abnahme.
