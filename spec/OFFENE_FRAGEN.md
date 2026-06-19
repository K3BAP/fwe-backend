# FlightMeet – Offene Fragen (lebendes Dokument)

> Vollständige, priorisierte Liste aller offenen Entscheidungen aus der Domänenanalyse.
> Status je Frage: **_offen_** bis im Interview entschieden. Entschiedene Fragen wandern mit
> Begründung in `DECISIONS.md` und werden hier auf **_entschieden_** gesetzt.
>
> Priorität: **hoch** = blockiert Schema/Architektur · **mittel** = vor Implementierung der Domäne · **niedrig** = Detail/Politur

## ✅ Bereits entschieden (Details in [`DECISIONS.md`](DECISIONS.md))

- **T1 / Realtime:** → **Pragmatisches Polling** (TanStack Query, MySQL als SoT, kein externer Dienst). `ADR-001`
- **T2 / Deployment:** → **Uni-Webspace, nur SFTP**; Migrations lokal, **SQL-Dump per phpMyAdmin** für Prod; kein Cron → Status im Read-Pfad. `ADR-002`
- **T6 / TypeScript:** → **Jetzt voll auf TypeScript** (Zod `z.infer`). `ADR-003`
- **T4 / Auth-Stack:** → **CI4 + CodeIgniter Shield**, alleinige Identitätsquelle, kein Supabase. `ADR-004`
- **T5 / Login-Session:** → **Shield Session-Authenticator, HttpOnly-Cookie** (XSS-sicher). `ADR-004`
- **T3 / Chat-Engine:** → **eine polymorphe Engine** `conversations`/`messages`. `ADR-005`
- **T7 / Gruppen-Zugang:** → **zwei Achsen** `visibility` + `join_policy`. `ADR-006`
- **T8 / Geo/Spots:** → **kuratierte `spots`-Tabelle + Autocomplete**, Seed durch Assistent. `ADR-007`
- **Scope-Lücken (T10/T12/T13):** → **nur In-App-Benachrichtigungen** im Scope; Moderation, E-Mail-Flows, Impressum/DSGVO **deferred** (mit rechtl. Vorbehalt). `ADR-008`
- **T9 / Chat-MVP:** → **„Mittel"** (Senden, History, Ungelesen, Ersteller-Highlight, Reaktionen, Soft-Edit/Delete). `ADR-009`
- **Profil-Tiefe:** → **„Erweitert"** (Erfahrungslevel, Lizenz, Schirm, Heimat-Region, Flugstunden, alle optional). `ADR-010`
- **T11 / Bio-Format:** → **eingeschränktes Markdown + doppeltes Sanitizing**; Chat = Plaintext+Linkify. `ADR-011`
- **Runde 4 (Gruppe A–D):** → vollständig entschieden (`ADR-012`); **Code-Qualität** als verbindliches Prinzip (`ADR-013`).
- **Spec-Durchgang (Chat):** → einfache **Replies im MVP**; verwaiste Konversationen via Service+Tests (kein Admin-Endpunkt). `ADR-014`
- **Spec-Durchgang (Flugtreffen/Profil):** → keine Warteliste (voll ⇒ 409); Organisator zählt mit; `meetup_participants` schlank; `@handle` bestätigt. `ADR-015`

**Erledigt:** Detail-Spezifikation je Domäne ausgearbeitet — Kapitel `01–06` + `DATA_MODEL.md` + `API.md` + `SEED_DATA.md` geschrieben.

---

## ✅ Interview-Runde 4 — ENTSCHIEDEN (ADR-012 · ADR-013)

> Alle Punkte der Gruppen A–D sind entschieden — überwiegend wie empfohlen. **Abweichungen:** B2 — der
> Feed bekommt **Emoji-Reaktionen** (`feed_post_reactions`); C6 — Edit-Fenster **15 min** statt unbegrenzt.
> Begründung in [`DECISIONS.md`](DECISIONS.md) (ADR-012 Schema/Produkt, ADR-013 Code-Qualität).
> Verbleibende **TODOs** (kein Blocker): D3 (Webspace-Tests: SMTP/Quota/ETag), D4 (Admin-Login für Abnahme).
> Die Items unten bleiben als Protokoll stehen — die jeweilige Empfehlung wurde übernommen, sofern oben
> keine Abweichung genannt ist.

### Gruppe A — Schema-Blocker (VOR dem Schreiben der Migrations entscheiden)
- **A1 [hoch] `users.id`-Typ:** durchgängig **`BIGINT UNSIGNED`** (Shield-`users`-Migration überschreiben) vs. überall `INT UNSIGNED`. → *Empfehlung: BIGINT UNSIGNED durchgängig.* Sonst schlägt jede user-FK typbedingt fehl. (`DATA_MODEL.md:15`, `01:31`)
- **A2 [hoch] Chat-Delta beim Polling:** Spalte **`messages.updated_at`** einführen, damit der Live-Tail auch Edits/Deletes/Reaktionen liefert (reines `id > since` verpasst sie). → *Empfehlung: ja.* (`04:208`)
- **A3 [mittel] Genau eine Meetup-Konversation:** partieller **`UNIQUE(type, context_type, context_id)`** für `type='meetup'`. → *Empfehlung: ja.* (`04:44`)
- **A4 [mittel] Eigene Spots:** dürfen Nutzer Spots anlegen oder pflegt nur **Admin/Seed** die `spots`-Liste? → *Empfehlung MVP: nur Admin/Seed* (kein `POST /spots`). (`DATA_MODEL.md:202`, `API.md:207`)

### Gruppe B — Produkt / Sichtbarkeit
- **B1 [mittel] Gäste-Lesezugriff:** Welche Seiten sind ohne Login lesbar — Flugtreffen-Übersicht/-Detail, Gruppen-Verzeichnis, öffentliche Profile/Feeds? → *Empfehlung: öffentlich lesbar (Marketing-Wirkung); Aktionen (Teilnehmen/Beitreten/Chatten) erfordern Login.* (`TARGET_SPEC` Route-Tabelle)
- **B2 [niedrig] Feed-Interaktion:** reiner Broadcast (nur Admin-Posts) oder Kommentare/Reaktionen am Feed? → *Empfehlung: reiner Broadcast im MVP.* (`03:203`)
- **B3 [niedrig] `private`+`open`:** erlauben (mit UI-Warnung) oder per Validierung verbieten? → *Empfehlung: erlauben + Hinweis.* (`03:59`)
- **B4 [niedrig] `moderator` in `admin`-Channels:** Zugriff? → *Empfehlung: nein.* (`03:166`)
- **B5 [niedrig] Gruppe ↔ Flugtreffen:** kann eine Gruppe ein Treffen veranstalten? → *Empfehlung: nein im MVP.* (`03:315`)

### Gruppe C — Felder / Daten-Detail
- **C1 [niedrig] `license_class`:** Enum vs. Freitext. → *Empfehlung: Freitext* (nationale Klassen variieren). (`01:65`)
- **C2 [niedrig] Profilfeld-Sichtbarkeit:** z.B. `home_region` öffentlich vs. nur Eingeloggte. → *Empfehlung: reduzierte öffentliche Karte, volle Felder für Eingeloggte.*
- **C3 [niedrig] Gruppen-Banner:** zusätzlich zu `logo_path`? → *Empfehlung: nur Logo im MVP.* (`03:305`)
- **C4 [niedrig] `groups.owner`-FK bei Owner-Löschung:** `RESTRICT`/Transfer vs. `CASCADE`. → *Empfehlung: RESTRICT* (Soft-Delete macht es unkritisch). (`DATA_MODEL.md:323`)
- **C5 [niedrig] Konversation bei Domänen-Löschung:** Soft- vs. Hard-Delete. → *Empfehlung: Soft* (History eingefroren). (`04:107`)
- **C6 [niedrig] Edit-Zeitfenster** für Nachrichten (z.B. 15 min)? → *Empfehlung: unbegrenzt im MVP.* (`04:163`)
- **C7 [niedrig] Notification-Aggregation:** eine `chat_message`-Notification pro Konversation? → *Empfehlung: ja.* (`04:186`)
- **C8 [niedrig] `notifications.type`-Keys:** finaler Satz (Spalte ist `VARCHAR`, erweiterbar). → *Vorschlag liegt vor (`API.md:607`); beim Feature-Bau festklopfen.*

### Gruppe D — Rahmen / organisatorisch (kurz bestätigen)
- **D1** UI-Sprache durchgängig **Deutsch** — bestätigen.
- **D2** Abgabe-/Bewertungskriterien des Moduls (Gewicht von Tests, Barrierefreiheit, Doku) — beeinflusst Priorisierung der Meilensteine.
- **D3** Praxistests auf dem **echten Webspace** (Aufgabe, früh): SMTP-Fähigkeit, Schreibrechte/Quota für `public/media/uploads/`, ob `ETag`/`304` durchgereicht wird.
- **D4** Admin-Login für die Abnahme: gemeinsame Demo-Credentials vs. dem Prüfer separat mitgeteilt. (`SEED_DATA.md:218`)

---

---

## Zusammenfassung der wichtigsten Architektur-Weichen (Top-Fragen)

**T1. [hoch] (Chat & Realtime / Architektur-Kern)** Realtime-Chat-Architektur: Akzeptieren wir für einen echten 'kein Polling'-Chat einen externen Dienst, oder weichen wir 'kein Polling' bewusst auf und nutzen Polling? Auf dem reinen Uni-Webspace mit CI4/MySQL ist echtes Push technisch unmöglich — es gibt keinen vierten Weg.

**T2. [hoch] (Backend & Deployment)** Läuft die Demo/Abnahme auf dem geteilten Uni-Webspace, oder darf sie lokal/auf anderer Infrastruktur laufen? Und gibt es SSH-Zugang zum Webspace oder nur SFTP/lftp?

**T3. [hoch] (Chat / Gruppen / Backend (Querschnitt))** Eine gemeinsame, polymorphe Chat-Engine für ALLE Chat-Orte (Gruppen-Channels, Flugtreffen-Chat, DMs), oder getrennte Tabellen pro Kontext?

**T4. [hoch] (Auth & Profile)** Auth-Stack: CI4+MySQL-eigene Auth als alleinige Identitätsquelle bestätigen (und Supabase NICHT für Auth)? Und mit CodeIgniter Shield oder schlanker Eigenbau-Auth?

**T5. [hoch] (Auth / Backend / Frontend)** Token-Format und -Speicherung: opaque Bearer Token in localStorage (wie Vorgänger) oder HttpOnly-JWT-Cookie?

**T6. [hoch] (Frontend-Architektur)** TypeScript einführen (jetzt) oder bei Vanilla JSX bleiben?

**T7. [hoch] (Gruppen / Communities)** Gruppen-Sichtbarkeit und Beitritt: zwei orthogonale Felder (visibility + join_policy) oder ein einzelnes Enum?

**T8. [hoch] (Flugtreffen / Geo-Daten)** Geo-Koordinaten für die Leaflet-Kartenansicht: kuratierte spots-Tabelle, Freitext+Geocoding oder Map-Picker? Und wer befüllt die Spots mit echten Startplatz-Daten?

**T9. [mittel] (Chat & Realtime)** MVP-Schnitt des Chat-Systems: Welche Features sind im ersten Wurf, welche bewusst Phase 2?

**T10. [mittel] (Auth & Profile)** E-Mail-abhängige Flows (Double-Opt-In-Verifikation, Passwort-Reset): im Scope, und ist SMTP auf dem Webspace verfügbar?

**T11. [mittel] (Auth & Profile / Frontend (Sicherheit))** Bio/nutzergenerierter Rich-Text: eingeschränktes Markdown, WYSIWYG oder Plaintext — und wie wird XSS verhindert?

**T12. [mittel] (Querschnitt: Auth / Gruppen / Moderation)** Globale Plattform-Rolle und Moderation: Reicht user/admin, und gibt es ein plattformweites Melde-/Moderationssystem für nutzergenerierten Content?

**T13. [mittel] (Querschnitt: Recht/DSGVO (Lücke))** Rechtliches & Datenschutz für DE: Impressum, Datenschutzerklärung, Consent für Drittanbieter (Supabase/Pusher/OSM) und Nutzer-Datenlöschung — im Scope?


---


## Auth & Profile

### A1. [hoch] Wo lebt die Authentifizierung: CI4-eigene Auth gegen MySQL oder Supabase Auth?
- **Warum wichtig:** Diese Entscheidung determiniert fast alle anderen Auth/Profil-Fragen (Token-Format, Passwort-Reset, E-Mail-Versand, Storage, Realtime, RLS vs. CI4-Filter). Der geteilte Webspace kann keine WebSockets/langlaufenden Prozesse — der einzige starke Treiber Richtung Supabase ist der Realtime-Chat. Ein zweiter Backend-Stack erhöht die Komplexität erheblich.
- **Optionen:**
    - A) Komplett CI4+MySQL: eigene Auth, Chat per Polling (wie Vorgänger). Kein zweiter Stack.
    - B) Komplett Supabase als BaaS: Supabase Auth + Postgres + Realtime + Storage; CI4 nur noch dünn/optional.
    - C) Hybrid: CI4+MySQL als primäres Backend (Auth, Profile, Domänenlogik), Supabase NUR für Realtime-Chat (separater Auth-Kontext, Brücke nötig).
    - D) CI4+MySQL für alles, Realtime-Chat per Polling (TanStack Query refetchInterval) — Anforderung 'kein Polling' bewusst aufweichen.
- **Empfehlung:** Empfehlung A bzw. D als Default für den Auth/Profil-Teil: Auth bei CI4+MySQL halten (opaque Bearer Token, konsistent mit dem Vorgänger und dem Deployment-Realismus). Supabase nur dann einführen, wenn die Realtime-Chat-Anforderung verbindlich 'kein Polling' verlangt — und dann als Option C, wobei die identitätsführende Quelle CI4 bleibt und Supabase ein nachgelagerter Realtime-Layer ist. Ein doppelter Auth-Stack (Option B) ist für ein Studierenden-Projekt unnötig riskant, solange CI4 bereits vorgegeben ist.
- **Entscheidung:** _offen_

### A2. [hoch] Welches Auth-Token-Format: CI4-Session-Cookies, opaque Bearer Token oder JWT?
- **Warum wichtig:** Bestimmt SPA-Integration, CSRF-Oberfläche, Logout/Revocation-Fähigkeit und Skalierung. Same-origin (SPA aus public/) erlaubt theoretisch httpOnly-Cookies; der Vorgänger nutzte aber opaque Bearer Token in localStorage.
- **Optionen:**
    - A) Opaque Bearer Token in localStorage (Vorgänger-Pattern): serverseitig in DB nachschlagbar, sofort widerrufbar, einfach.
    - B) CI4-Session-Cookies (httpOnly, SameSite=Lax): kein localStorage-XSS-Token-Diebstahl, aber CSRF-Schutz nötig, weniger 'stateless'.
    - C) Self-contained JWT: stateless, aber schwer widerrufbar; für ein Uni-Projekt überdimensioniert.
- **Empfehlung:** Empfehlung A (opaque Bearer Token), aber als gehashter Token-Record in einer Tabelle auth_tokens mit expires_at und last_used_at, gesendet via Authorization: Bearer. Konsistenz mit dem Vorgängerprojekt, einfache serverseitige Revocation (Logout/'alle Geräte abmelden'), keine CSRF-Komplexität. Hinweis auf XSS-Risiko bei localStorage in den Risks. Falls Supabase-Auth gewählt wird, entfällt diese Frage zugunsten von Supabase-JWTs.
- **Entscheidung:** _offen_

### A3. [hoch] Registrierung: Welche Felder und welcher Identifier — E-Mail+Passwort, zusätzlich eindeutiger Username/Handle?
- **Warum wichtig:** Der Profilname muss nicht eindeutig sein, aber Login und @-Erwähnungen/Profil-URLs profitieren von einem eindeutigen Handle. Klärt auch, ob Anzeigename != Login-Identität.
- **Optionen:**
    - A) Login per E-Mail + Passwort; separater frei wählbarer Anzeige-Name (nicht eindeutig).
    - B) Zusätzlich eindeutiger @username/Handle (für Profil-URL /u/handle und Erwähnungen).
    - C) Login per Username ODER E-Mail.
- **Empfehlung:** Empfehlung A+B: Login via E-Mail+Passwort, plus optionaler eindeutiger Handle für saubere Profil-URLs und spätere @-Mentions im Chat. Pflicht bei Registrierung: E-Mail, Passwort, Anzeigename. Handle kann beim ersten Profil-Setup vergeben werden.
- **Entscheidung:** _offen_

### A4. [mittel] Ist eine E-Mail-Verifikation (Double-Opt-In) erforderlich?
- **Warum wichtig:** Verifikation braucht ausgehenden E-Mail-Versand. Der geteilte Uni-Webspace kann SMTP evtl. nicht zuverlässig/erlaubt nicht — das ist ein echtes Deployment-Risiko. Ohne Verifikation sind Konten leichter zu faken.
- **Optionen:**
    - A) Keine Verifikation (einfachster Scope, akzeptabel für Uni-Demo).
    - B) E-Mail-Verifikation via CI4 Email + SMTP (z.B. Uni-SMTP oder externer Provider).
    - C) Verifikation über Supabase Auth (falls Supabase gewählt — E-Mail-Versand inklusive).
- **Empfehlung:** Empfehlung A für die erste Iteration (Scope-realistisch, keine SMTP-Abhängigkeit auf dem Webspace), mit Datenmodell-Vorbereitung (Spalte email_verified_at) für späteres Nachrüsten. Falls Verifikation gefordert: B nur mit verlässlichem externen SMTP (z.B. Provider-API), nicht mit dem unklaren Webspace-Mailer.
- **Entscheidung:** _offen_

### A5. [mittel] Wird ein Passwort-Reset-Flow ('Passwort vergessen') benötigt?
- **Warum wichtig:** Setzt ebenfalls E-Mail-Versand voraus (gleiche SMTP-Frage). Ohne Reset müssen Nutzer bei Passwortverlust manuell betreut werden.
- **Optionen:**
    - A) Kein Self-Service-Reset in der ersten Iteration.
    - B) Token-basierter Reset per E-Mail (CI4) — abhängig von SMTP.
    - C) Reset über Supabase Auth (falls gewählt).
- **Empfehlung:** Empfehlung: gekoppelt an die E-Mail-Verifikations-Entscheidung. Wenn kein verlässlicher SMTP verfügbar ist, A (kein Reset) für die Demo; sonst B. Tabelle password_resets im Schema vorsehen, aber Implementierung optional.
- **Entscheidung:** _offen_

### A6. [niedrig] Soll OAuth / Social-Login (z.B. Google) angeboten werden?
- **Warum wichtig:** Reduziert Reibung, erhöht aber Komplexität (Redirect-URIs, Provider-Konfiguration) und passt nicht zwingend zur Zielgruppe (Gleitschirm-Community). OAuth-Redirects sind auf dem geteilten Webspace machbar, aber Mehraufwand.
- **Optionen:**
    - A) Kein OAuth — nur E-Mail/Passwort.
    - B) Google-Login zusätzlich (CI4 mit OAuth-Lib oder Supabase Auth).
    - C) Supabase Social Auth (falls Supabase gewählt — geringster Implementierungsaufwand).
- **Empfehlung:** Empfehlung A. Für ein fwe-Uni-Projekt ist E-Mail/Passwort ausreichend und vermeidet Provider-Setup. OAuth nur, wenn es explizit als Lernziel/Anforderung gewünscht ist; dann am günstigsten über Supabase Auth (C).
- **Entscheidung:** _offen_

### A7. [hoch] Soll CodeIgniter Shield als fertige Auth-Library eingesetzt werden, oder eine schlanke Eigenbau-Auth?
- **Warum wichtig:** Shield ist das offizielle CI4-Auth-Paket (Passwort-Hashing, Tokens via HMAC/access tokens, Groups/Permissions, Migrations). Es bringt viel mit, aber auch Konventionen/Tabellen, die man verstehen muss. Aktuell ist Shield NICHT installiert (verifiziert: kein vendor-Eintrag).
- **Optionen:**
    - A) CI4 Shield installieren: bewährt, Access-Token-Support (HasAccessTokens), Rollen/Gruppen out-of-the-box.
    - B) Schlanke Eigenbau-Auth (eigene users + auth_tokens Tabellen, password_hash/password_verify, eigener Filter) — wie der Vorgänger es de facto tat.
    - C) Supabase Auth (kein CI4-Auth-Code).
- **Empfehlung:** Empfehlung A (Shield) für technische Sauberkeit und um Rad-Neuerfindung zu vermeiden — insbesondere die Access-Token- und Groups-Funktionen passen exakt zu Bearer-Token + Plattform-Rollen. Falls das Team Shield-Konventionen als zu schwergewichtig empfindet und Konsistenz mit dem Vorgänger priorisiert, ist B legitim. Diese Frage hängt eng mit der Token-Format-Frage zusammen.
- **Entscheidung:** _offen_

### A8. [mittel] Welche pilotenspezifischen Profilfelder soll es geben und welche sind Pflicht?
- **Warum wichtig:** Passt thematisch zur Gleitschirm-Community und macht Profile/Profilkarte aussagekräftig (Erfahrungslevel, Heimat-Spot fürs Matching von Flugtreffen). Pflichtfelder beeinflussen Registrierungs-/Onboarding-UX.
- **Optionen:**
    - A) Minimal: nur Profilbild, Name, Bio (wie Mindestanforderung).
    - B) Erweitert optional: Erfahrungslevel (Anfänger/Fortgeschritten/Profi), Heimat-Spot/Region, Schein/Lizenz (z.B. A-Schein/B-Schein), Flugstunden, Schirm-Marke/-Modell, Mitgliedsjahr.
    - C) Erweitert mit einigen Pflichtfeldern (z.B. Erfahrungslevel Pflicht für besseres Matching).
- **Empfehlung:** Empfehlung B: Pflicht nur Name (Profilbild und Bio optional mit Default-Avatar/Platzhalter). Zusätzliche Pilotenfelder als optionale, strukturierte Felder — Erfahrungslevel als Enum, Heimat-Spot als Freitext/Region, Lizenz als Enum, Flugstunden als Integer, Schirm als Freitext. Optionalität hält die Registrierung niedrigschwellig; strukturierte Enums ermöglichen späteres Filtern/Matching bei Flugtreffen.
- **Entscheidung:** _offen_

### A9. [hoch] Wie wird die Bio gestaltet: Markdown, Rich-Text-Editor oder Plain-Text?
- **Warum wichtig:** 'Hübsch gestaltbar' impliziert Formatierung; jede Nicht-Plain-Variante öffnet eine XSS-Angriffsfläche, die serverseitig sanitisiert werden MUSS. Bestimmt Editor-Lib im Frontend und Render-/Sanitizing-Strategie.
- **Optionen:**
    - A) Eingeschränktes Markdown (fett, kursiv, Listen, Links, Absätze) — gerendert mit Sanitizing (z.B. serverseitig HTMLPurifier-Äquivalent oder client-seitig DOMPurify), KEIN rohes HTML.
    - B) WYSIWYG-Rich-Text (z.B. TipTap) — komfortabler, aber komplexer und größere XSS-Fläche.
    - C) Plain-Text mit automatischer Link-Erkennung — sicherste, einfachste Variante.
- **Empfehlung:** Empfehlung A: eingeschränktes Markdown. Speichere Markdown-Quelltext in der DB, rendere zu HTML und sanitisiere zwingend (Allowlist von Tags). Kein roher HTML-Input. Frontend: Markdown-Editor + Vorschau; Rendering mit DOMPurify zusätzlich client-seitig. Begrenze die Bio-Länge (z.B. 1000 Zeichen). XSS-Sanitizing ist hier ein nicht verhandelbares Muss.
- **Entscheidung:** _offen_

### A10. [mittel] Wo werden Profilbilder gespeichert: writable/uploads auf dem Webspace oder Supabase Storage?
- **Warum wichtig:** writable/uploads existiert bereits im Repo, ist aber in .deployignore NICHT pauschal ausgeschlossen (nur writable/debugbar) — Persistenz/Schreibrechte auf dem geteilten Webspace und Auslieferung der Dateien müssen geklärt werden. Supabase Storage löst Persistenz+CDN, bindet aber an Supabase.
- **Optionen:**
    - A) writable/uploads/ auf dem Webspace, ausgeliefert über einen CI4-Controller oder einen public-symlink/-Pfad; serverseitiges Resizing/Cropping.
    - B) Supabase Storage (öffentlicher Bucket) — CDN, kein Webspace-Speicherproblem, aber Supabase-Abhängigkeit.
    - C) Externer Bild-Host/Gravatar als Übergang.
- **Empfehlung:** Empfehlung A, wenn Auth bei CI4 bleibt: Upload in einen nicht-public writable-Ordner, Auslieferung über einen authentifizierbaren CI4-Endpoint (oder nach public/uploads kopieren). Serverseitig auf ein quadratisches Format normalisieren (z.B. 512x512, plus 128er-Thumbnail), Dateityp/Größe validieren (nur JPEG/PNG/WebP, z.B. max 5 MB), Dateinamen randomisieren. Cropping client-seitig vor Upload (z.B. react-easy-crop). Default-Avatare (Initialen oder Gleitschirm-Icon) wenn kein Bild. Supabase Storage (B) nur, wenn Supabase ohnehin eingeführt wird.
- **Entscheidung:** _offen_

### A11. [mittel] Welche Profildaten sind öffentlich vs. privat, und sieht die Profilkarte für Eingeloggte/Nicht-Eingeloggte dasselbe?
- **Warum wichtig:** Die Profilkarte wird querschnittlich angezeigt; E-Mail und ggf. genauer Heimat-Spot sind sensibel. Klärt, welche Felder die /api/users/{id}-Antwort enthält und ob Profile ohne Login sichtbar sind.
- **Optionen:**
    - A) Öffentliches Profil = Name, Avatar, Bio, Erfahrungslevel, Heimat-Spot; privat = E-Mail, exakte Standortdaten. Profile nur für Eingeloggte sichtbar.
    - B) Profile auch unangemeldet sichtbar (SEO/Sharing), mit reduziertem öffentlichem Subset.
    - C) Nutzer-konfigurierbare Sichtbarkeit pro Feld.
- **Empfehlung:** Empfehlung A: E-Mail niemals in öffentlichen Profil-/Profilkarten-Responses; Profile nur für eingeloggte Nutzer abrufbar (passt zur Community-Natur). Pro-Feld-Sichtbarkeit (C) ist nice-to-have, für die erste Iteration überdimensioniert. Profilkarte zeigt: Avatar, Name, Erfahrungslevel, Heimat-Spot, Kurz-Bio (gekürzt) + Buttons 'Profil ansehen' und 'Nachricht senden'.
- **Entscheidung:** _offen_

### A12. [mittel] Gibt es globale Plattform-Rollen (Admin/Moderator) zusätzlich zu normalen Nutzern?
- **Warum wichtig:** Moderation (Profile/Bios/Bilder melden, Nutzer sperren) braucht eine Rollen-Dimension. Auch der Seed eines ersten Admins muss definiert sein. Beeinflusst das Datenmodell (role-Spalte oder Groups) und Authorization-Filter.
- **Optionen:**
    - A) Nur eine Rolle 'user' (kein Admin) — minimaler Scope.
    - B) Rollen user + admin (Plattform-Admin kann moderieren/sperren).
    - C) user + moderator + admin (feinere Trennung).
- **Empfehlung:** Empfehlung B: eine einfache role-Spalte (oder Shield-Group) mit user und admin. Admin ermöglicht Basis-Moderation (Nutzer sperren, gemeldete Inhalte entfernen) und wird per Seed/SQL gesetzt. Gruppen-/Community-Rollen (z.B. Gruppen-Owner) sind eine separate Domäne und gehören NICHT in die globale Plattform-Rolle.
- **Entscheidung:** _offen_

### A13. [niedrig] Soll ein Konto deaktiviert/gelöscht werden können (Sperren, Self-Service-Löschung, DSGVO)?
- **Warum wichtig:** DSGVO-Relevanz bei personenbezogenen Daten (E-Mail, Bild, Bio). Soft-Delete vs. Hard-Delete beeinflusst, wie Nutzername/Inhalte des Nutzers in Gruppen/Chats nach Löschung dargestellt werden ('Gelöschter Nutzer').
- **Optionen:**
    - A) Kein Lösch-Flow in der ersten Iteration (nur Admin-Sperre).
    - B) Soft-Delete (status=deleted, Daten anonymisiert, Inhalte bleiben als 'Gelöschter Nutzer').
    - C) Hard-Delete mit Kaskade.
- **Empfehlung:** Empfehlung B: Soft-Delete/Anonymisierung über eine status-Spalte (active/suspended/deleted). Erhält referentielle Integrität in Chats/Gruppen, erfüllt DSGVO durch Anonymisierung. Hard-Delete (C) nur auf expliziten Wunsch wegen Kaskadenrisiko.
- **Entscheidung:** _offen_


## Flugtreffen (Meetups)

### FT1. [hoch] Woher kommen die Geo-Koordinaten (lat/lng), die Leaflet für die Kartenansicht zwingend braucht? Die Anforderung nennt 'Flugspot' nur als Textfeld.
- **Warum wichtig:** Ohne lat/lng kann kein Marker gesetzt werden — die Kartenansicht ist sonst nicht umsetzbar. Die Entscheidung bestimmt Datenmodell (spots-Tabelle ja/nein), Erstellen-UX und ob ein externer Geocoding-Dienst nötig wird.
- **Optionen:**
    - A) Vordefinierte Spot-Datenbank (Tabelle 'spots' mit name, region, lat, lng) — Ersteller wählt Spot aus Dropdown/Autocomplete; Koordinaten kommen aus dem Spot.
    - B) Freitext-Flugspot + Geocoding (Nominatim/OSM) beim Speichern serverseitig auflösen.
    - C) Interaktiver Leaflet-Picker im Erstellen-Wizard: Nutzer klickt Position auf der Karte, lat/lng werden direkt gespeichert.
    - D) Kombination: kuratierte spots-Tabelle als Primärquellе + Map-Picker als Fallback für neue Spots.
- **Empfehlung:** Option D als Zielbild, für den realistischen Studierenden-Scope aber A starten: Eine kleine kuratierte 'spots'-Tabelle (10-30 bekannte Startplätze, z.B. Trier/Mosel/Alpen) mit fixen Koordinaten, Auswahl per Autocomplete. Vermeidet Geocoding-Abhängigkeit/Rate-Limits, garantiert saubere Map-Marker, normalisiert zugleich die Region. Map-Picker (C) optional als spätere Ausbaustufe.
- **Entscheidung:** _offen_

### FT2. [hoch] Welche genauen Stufen umfasst das Enum 'Erfahrungslevel'?
- **Warum wichtig:** Wird als Filter UND als Pflichtfeld beim Erstellen verwendet; muss DB-seitig (ENUM/Lookup) und im Frontend (Dropdown/Filter) identisch sein. Nachträgliche Änderung ist eine Migration.
- **Optionen:**
    - A) Schein-orientiert: 'A-Schein/Anfänger', 'B-Schein/Fortgeschritten', 'Profi/Streckenflug'.
    - B) Generisch 3-stufig: 'Anfänger', 'Fortgeschritten', 'Experte'.
    - C) 4-stufig inkl. 'Alle Level' als eigenständige Stufe für offene Treffen.
    - D) Mehrfachauswahl (ein Treffen erlaubt mehrere Level gleichzeitig).
- **Empfehlung:** Option C: drei Kompetenzstufen 'anfaenger' | 'fortgeschritten' | 'experte' plus expliziter Wert 'alle' für offene Treffen. Als String-Enum mit deutschen Labels im Frontend. Mehrfachauswahl (D) erhöht Komplexität bei Filter/DB ohne klaren Mehrwert für den Scope — bewusst weglassen.
- **Entscheidung:** _offen_

### FT3. [hoch] Welche Werte hat das Feld 'Status' und wie werden Übergänge ausgelöst (insb. 'vergangen')?
- **Warum wichtig:** Status steuert Anzeige (Badge), Filter und ob 'Teilnehmen' erlaubt ist. 'Voll' und 'vergangen' sind abgeleitete Zustände — werden sie persistiert oder berechnet? Das beeinflusst, ob ein Cronjob nötig ist (auf dem geteilten Webspace problematisch).
- **Optionen:**
    - A) Persistiertes Enum 'geplant' | 'voll' | 'abgesagt' | 'abgeschlossen', Übergänge per Cronjob/Scheduled Task.
    - B) Nur 'abgesagt' wird persistiert; 'voll' (aus Teilnehmerzahl) und 'abgeschlossen' (aus Datum < jetzt) werden zur Laufzeit/serverseitig berechnet — kein Cron nötig.
    - C) Wie B, zusätzlich 'entwurf' für noch nicht veröffentlichte Treffen.
- **Empfehlung:** Option B: Persistiere nur ein minimales Flag (z.B. is_cancelled bzw. status='abgesagt') plus die Rohdaten. 'voll' = teilnehmer >= max; 'abgeschlossen' = datum_uhrzeit < NOW(). Beides serverseitig im SELECT/Resource berechnen und als computed 'status' ausliefern. Vermeidet den auf dem Uni-Webspace unzuverlässigen Cronjob und Inkonsistenzen. Frontend zeigt das berechnete Status-Badge.
- **Entscheidung:** _offen_

### FT4. [hoch] Wie wird die Race-Condition beim letzten freien Platz behandelt, und gibt es eine Warteliste?
- **Warum wichtig:** Zwei gleichzeitige 'Teilnehmen'-Klicks könnten max. überschreiten. Betrifft Datenintegrität und ob eine Warteliste die Teilnahme-Logik/UX verkompliziert.
- **Optionen:**
    - A) Keine Warteliste; Atomarität über DB-Transaktion + UNIQUE(meetup_id,user_id) + serverseitige Kapazitätsprüfung in einer Transaktion (ggf. SELECT ... FOR UPDATE). Bei Voll: 409-Antwort + Fehler-Toast.
    - B) Warteliste: bei Voll wird Nutzer mit Status 'warteliste' eingetragen, rückt bei Absage nach.
    - C) Optimistisch ohne DB-Lock (nur App-Check) — Race bewusst akzeptiert (Demo-Scope).
- **Empfehlung:** Option A: Serverseitige Kapazitätsprüfung innerhalb einer Transaktion plus UNIQUE-Constraint auf (meetup_id,user_id) gegen Doppel-Anmeldung. Sauber, lehrbuchkonform für 'fortgeschrittene' Webentwicklung und ohne Cron. Warteliste (B) als klar markiertes Optional-Feature, falls Zeit bleibt.
- **Entscheidung:** _offen_

### FT5. [hoch] Zählt der Ersteller automatisch als Teilnehmer, und welche Sonderrechte hat er?
- **Warum wichtig:** Bestimmt Anfangs-Teilnehmerzahl, freie Plätze und die Berechtigungslogik (Bearbeiten/Löschen/Teilnehmer entfernen).
- **Optionen:**
    - A) Ersteller wird beim Anlegen automatisch als Teilnehmer #1 eingetragen und zählt mit.
    - B) Ersteller ist Organisator, zählt NICHT zur Teilnehmerzahl, kann aber separat teilnehmen.
    - C) Ersteller zählt mit UND hat zusätzlich Admin-Rechte am Treffen (bearbeiten, absagen, Teilnehmer entfernen).
- **Empfehlung:** Option C: Ersteller wird automatisch eingetragen (zählt mit) und erhält über das Feld creator_user_id Admin-Rechte am eigenen Treffen: bearbeiten, absagen, Teilnehmer entfernen. Konsistent mit der Chat-Anforderung (Ersteller-Nachrichten hervorgehoben → Ersteller ist klar identifizierbar). Ersteller kann sich nicht selbst 'absagen', solange das Treffen existiert (stattdessen 'Treffen absagen').
- **Entscheidung:** _offen_

### FT6. [hoch] Wer darf Flugtreffen erstellen, bearbeiten, löschen/absagen — und gibt es überhaupt Authentifizierung in diesem Scope?
- **Warum wichtig:** Teilnahme, Ersteller-Rechte und Chat setzen einen identifizierten Nutzer voraus. Ob Auth Teil dieser Domäne ist oder einer separaten Auth-/Profil-Domäne, muss geklärt sein, sonst sind 'angemeldeter Nutzer' und Berechtigungen undefiniert.
- **Optionen:**
    - A) Jeder eingeloggte Nutzer darf erstellen; nur Ersteller (oder globaler Admin) darf bearbeiten/absagen — setzt vorhandene Auth voraus.
    - B) Auth liegt in separater Domäne; hier wird nur die User-ID konsumiert (current_user via Session/Token).
    - C) Kein echtes Auth im MVP: ein simulierter 'aktueller Nutzer' (fixe/gewählte User-ID) für die Demo.
- **Empfehlung:** Option B kombiniert mit A-Regeln: Diese Domäne setzt einen authentifizierten current_user voraus (über Session/JWT aus der Auth-Domäne) und konsumiert dessen ID. Berechtigungen: erstellen = jeder eingeloggte; bearbeiten/absagen/Teilnehmer entfernen = nur creator oder Admin. Auth-Mechanismus selbst als eigene Domäne/Open Question führen, hier nur die Abhängigkeit dokumentieren.
- **Entscheidung:** _offen_

### FT7. [mittel] Läuft Suche und Filterung server- oder clientseitig, und mit welcher Technik (FULLTEXT vs. LIKE)?
- **Warum wichtig:** Bestimmt API-Design (Query-Parameter vs. alles laden), Performance, und ob Pagination nötig ist. Auf dem geteilten Webspace mit kleiner DB ist beides machbar, aber das Vorgehen muss festgelegt sein.
- **Optionen:**
    - A) Serverseitig via Query-Parameter: ?q=&region=&level=&status=&date_from=&date_to= mit LIKE-Suche und SQL-WHERE; Pagination (limit/offset).
    - B) Serverseitig mit MySQL FULLTEXT-Index über (titel, flugspot, region, beschreibung).
    - C) Clientseitig: alle Treffen laden, Suche/Filter in React/TanStack Query im Speicher.
- **Empfehlung:** Option A: serverseitige Filterung über Query-Parameter mit LIKE (für den erwarteten kleinen Datenbestand völlig ausreichend) und limit/offset-Pagination. Hält die Kartenansicht performant und ist die saubere REST-Variante. FULLTEXT (B) als optionales Upgrade, falls Volltextrelevanz gewünscht. Rein clientseitig (C) nur als Fallback, skaliert aber nicht und lädt die Map unnötig voll.
- **Entscheidung:** _offen_

### FT8. [mittel] Wird 'Region' als freie Texteingabe oder als kontrolliertes Enum/Lookup geführt?
- **Warum wichtig:** Region ist gleichzeitig Such-, Filter- und (laut Spot-Frage) potenziell abgeleitetes Feld. Freitext macht den Region-Filter unzuverlässig (Tippfehler, Dubletten).
- **Optionen:**
    - A) Kontrolliertes Enum/Lookup-Tabelle 'regions' (z.B. Eifel, Mosel, Hunsrück, Schwarzwald, Alpen, …), Auswahl per Dropdown.
    - B) Freitext-Region.
    - C) Region wird automatisch aus dem gewählten Spot abgeleitet (wenn Spot-DB, Option A der Spot-Frage).
- **Empfehlung:** Option C wenn die Spot-Datenbank kommt (Region = spot.region, kein separates Eingabefeld), sonst A (Lookup-Liste). In beiden Fällen ist der Region-Filter dadurch ein sauberes Dropdown statt fehleranfälligem Freitext.
- **Entscheidung:** _offen_

### FT9. [mittel] Werden Datum und Uhrzeit als ein kombiniertes Feld gespeichert, und gibt es Endzeit/Dauer?
- **Warum wichtig:** Beeinflusst DB-Spaltentyp (DATETIME vs. DATE+TIME), Sortierung, Datums-Filter und die Berechnung von 'abgeschlossen'.
- **Optionen:**
    - A) Ein DATETIME-Feld 'starts_at' (intern), im UI als getrennte Datums-/Uhrzeit-Picker.
    - B) Getrennte Spalten 'date' (DATE) und 'time' (TIME).
    - C) Wie A, zusätzlich optionales 'ends_at' (Dauer/Endzeit).
- **Empfehlung:** Option A: ein DATETIME 'starts_at' als Single Source of Truth (saubere Sortierung, einfacher Status-Vergleich gegen NOW()), im Formular über getrennte Date-/Time-Inputs zusammengesetzt. Endzeit (C) ist für den Scope verzichtbar — als Optional markieren.
- **Entscheidung:** _offen_

### FT10. [niedrig] Gibt es einen Umkreis-/Geo-Filter (z.B. 'Treffen im Umkreis von X km')?
- **Warum wichtig:** Thematisch naheliegend bei einer Kartenansicht, aber technisch aufwändig (Haversine/Spatial-Index) und nicht verbatim gefordert.
- **Optionen:**
    - A) Kein Umkreisfilter — nur Region/Level/Text/Datum.
    - B) Einfacher Umkreisfilter über Haversine-Formel in SQL (benötigt lat/lng am Treffen).
    - C) Map-driven: nur die im aktuellen Karten-Viewport sichtbaren Treffen anzeigen (Bounding-Box-Filter).
- **Empfehlung:** Option A für den MVP (Region-Filter deckt den Bedarf praktikabel ab). C (Bounding-Box) ist ein elegantes optionales Extra, sobald lat/lng vorhanden sind. B nur falls explizit gewünscht.
- **Entscheidung:** _offen_

### FT11. [mittel] Wie verhält sich der 'Teilnehmen'-Button für nicht-eingeloggte Nutzer und für den Ersteller?
- **Warum wichtig:** Verbatim ist nur das Toggle-Verhalten beschrieben; der Zustand für Gäste/Ersteller/volles Treffen ist offen und prägt die Detailansicht-UX.
- **Optionen:**
    - A) Gast: Button deaktiviert/leitet zu Login. Ersteller: zeigt 'Du bist Organisator' statt Teilnehmen. Voll (und nicht angemeldet): 'Ausgebucht' deaktiviert.
    - B) Alle sehen denselben Button; Berechtigungsfehler erst beim Klick (Toast).
    - C) Gäste sehen die Detailseite gar nicht (Login-Wall).
- **Empfehlung:** Option A: zustandsabhängiger Button (Teilnehmen / Absagen / Ausgebucht-deaktiviert / Login-Hinweis / Organisator-Hinweis). Beste UX und verhindert unnötige fehlschlagende Requests. Server validiert dennoch jede Aktion (Defense in Depth).
- **Entscheidung:** _offen_

### FT12. [niedrig] Sind wiederkehrende Treffen und/oder eine Wetter-Integration Teil des Scope?
- **Warum wichtig:** Beide sind thematisch sinnvoll, aber nicht gefordert und potenziell scope-sprengend (Recurrence-Logik bzw. externe Wetter-API + Rate-Limits/Keys).
- **Optionen:**
    - A) Beides außerhalb des Scope (MVP).
    - B) Wetter-Integration als read-only Anzeige in der Detailansicht (externe API, z.B. Open-Meteo, mit lat/lng/Datum).
    - C) Wiederkehrende Treffen über simples Wiederholungsmuster.
- **Empfehlung:** Option A für den Kern-MVP; Wetter (B) über Open-Meteo (kostenlos, kein API-Key) ist ein attraktives, gut abgegrenztes Optional-Feature für die Detailansicht, sobald lat/lng existieren. Recurrence (C) bewusst weglassen — schlechtes Aufwand/Nutzen-Verhältnis.
- **Entscheidung:** _offen_

### FT13. [niedrig] Soll die Deutsch-Regel (alle nutzer-sichtbaren Strings auf Deutsch) für FlightMeet bestätigt werden?
- **Warum wichtig:** Regel stammt aus dem Vorgänger-Projekt; betrifft Enum-Labels, Toasts, Buttons und API-Fehlermeldungen. Sollte vor Implementierung verbindlich sein.
- **Optionen:**
    - A) Ja, durchgängig Deutsch (UI-Strings, Toasts, Validierungsmeldungen).
    - B) UI Deutsch, aber technische API-Felder/Enum-Keys Englisch (nur Labels übersetzt).
    - C) Mehrsprachig (i18n) vorbereiten.
- **Empfehlung:** Option B: nutzer-sichtbare Strings durchgängig Deutsch, aber DB-Spalten und Enum-Keys technisch Englisch/neutral (z.B. status='cancelled' → Label 'Abgesagt'). Sauberste Trennung, erleichtert spätere i18n. Volles i18n (C) ist für den Scope unnötig.
- **Entscheidung:** _offen_


## Gruppen / Communities

### G1. [hoch] REALTIME-CHAT vs. DEPLOYMENT: Wie werden die Gruppen-Channels technisch realisiert, wenn der geteilte Uni-Webspace (hosting.wi1cm.uni-trier.de) keine WebSockets/SSE/langlaufenden Prozesse erlaubt, die Anforderung aber 'direkter Chat, KEIN Polling' lautet?
- **Warum wichtig:** Das ist der zentrale Architektur-Showstopper der gesamten Domaene. Channels sind das Herzstueck der Gruppen. Die Entscheidung determiniert Datenhaltung (MySQL vs. Supabase Postgres), Auth-Modell, ob ein zweiter Backend-Stack noetig ist, und ob 'kein Polling' ueberhaupt einhaltbar ist. Ohne Klaerung kann das Channel-Datenmodell nicht final festgelegt werden.
- **Optionen:**
    - A) Pragmatisches Polling via TanStack Query refetchInterval (wie City-Rallye), Chat-Nachrichten in MySQL. 'Kein Polling' wird verworfen — kurze Intervalle (2-3s) fuehlen sich nahezu live an. Keine zweite Infrastruktur.
    - B) Supabase Realtime (Postgres + WebSockets) NUR fuer Channel-Nachrichten; Rest (Gruppen-Metadaten, Mitgliedschaft, Feed) bleibt in CI4/MySQL. Zweigeteilter Stack, aber echtes Realtime.
    - C) Komplett-Migration des Chat-Subsystems (inkl. Auth/Realtime/Storage) auf Supabase als BaaS; CI4 bleibt fuer die uebrigen Domaenen.
    - D) Long-Polling/HTTP-Streaming-Workaround auf CI4 — auf billigem Shared-PHP-Webspace unzuverlaessig/nicht empfohlen.
- **Empfehlung:** Fuer ein Studierenden-Projekt mit realistischem Scope: Option A (Polling in MySQL) als sicherer Default — null zusaetzliche Infrastruktur, konsistent mit der bereits getroffenen City-Rallye-Entscheidung, deploybar auf dem Zielserver. Falls 'echtes Realtime ohne Polling' eine harte Bewertungs-/Demo-Anforderung ist, Option B (Supabase nur fuer Channels) als sauber gekapselter zweiter Stack. Option A zuerst bauen, B als optionales Upgrade.
- **Entscheidung:** _offen_

### G2. [hoch] Welche genaue Matrix aus Sichtbarkeit x Beitritt soll es geben? Konkret: Gibt es zusaetzlich zu 'oeffentlich/beitreten', 'privat/invite-only', 'privat/Antrag' auch den Reddit-'restricted'-Typ (Gruppe ist sichtbar und Feed lesbar, aber Beitritt nur per Antrag/Invite)?
- **Warum wichtig:** 'Sichtbarkeit' (taucht im Verzeichnis/Suche auf, Feed lesbar) und 'Beitrittsmodus' (wie wird man Mitglied) sind zwei orthogonale Achsen. Werden sie zu einem einzigen Enum vermischt, lassen sich gueltige Kombinationen wie 'sichtbar aber geschlossen' nicht abbilden. Der oeffentliche Feed fuer Nicht-Mitglieder legt nahe, dass Sichtbarkeit ohnehin separat behandelt werden muss.
- **Optionen:**
    - A) Zwei separate Felder: visibility (public/private/unlisted) + join_policy (open/request/invite_only). Maximale Flexibilitaet, deckt restricted/unlisted ab.
    - B) Ein einziges Enum mit 3 Werten: 'public' (sichtbar+beitreten), 'restricted' (sichtbar+Antrag), 'private' (unsichtbar+invite-only). Einfacher, deckt aber nicht alle Kombinationen ab.
    - C) Minimal: nur 'public' (beitreten) vs. 'private' (invite-only ODER Antrag, beides immer erlaubt).
- **Empfehlung:** Option A (zwei orthogonale Felder visibility + join_policy). Sauber, erweiterbar, und nur so laesst sich die bestaetigte Anforderung 'Feed oeffentlich auch fuer Nicht-Mitglieder' konsistent mit privaten Channels kombinieren. join_policy='invite_only' impliziert visibility kann trotzdem 'public' (auffindbar) sein -> deckt Reddit-restricted automatisch ab. Default neuer Gruppen: visibility=public, join_policy=open.
- **Entscheidung:** _offen_

### G3. [hoch] Welche Rollen gibt es in einer Gruppe und welche Rechte hat jede? Reichen Owner / Admin / Mitglied, oder wird zusaetzlich eine Moderator-Rolle benoetigt?
- **Warum wichtig:** Die Anforderung nennt 'Gruppen-Admins' (Feed-Posten, Mitgliederverwaltung) und einfache 'Mitglieder'. Ob es eine dazwischenliegende Moderator-Rolle (darf z.B. Posts/Nachrichten loeschen, aber keine Admins ernennen) gibt, bestimmt das Berechtigungsmodell und die DB (role-Enum). Mehr Rollen = mehr Implementierungsaufwand.
- **Optionen:**
    - A) 3 Rollen: owner (genau 1, kann Gruppe loeschen/uebertragen), admin (Channels anlegen, Feed posten, Mitglieder/Antraege/Invites verwalten, moderieren), member (lesen/schreiben in Channels). Empfohlen.
    - B) 4 Rollen: zusaetzlich moderator (Moderation in Channels: Nachrichten loeschen, Mitglieder kicken/bannen — aber keine Rollen-/Gruppen-Verwaltung). Naeher an Discord.
    - C) 2 Rollen: owner/admin kollabiert in eine Admin-Rolle + member. Minimal, aber kein Eigentums-Transfer abbildbar.
- **Empfehlung:** Option A (owner/admin/member) als Default — deckt alle verbatim genannten Faelle ab und haelt den Scope studierenden-realistisch. Moderator (Option B) als optionale spaetere Erweiterung; bei knapper Zeit weglassen. owner ist ein admin mit Zusatzrechten (Gruppe loeschen, Eigentum uebertragen, letzten Admin nicht entfernbar).
- **Entscheidung:** _offen_

### G4. [mittel] Wer darf Channels anlegen/loeschen/umbenennen — nur Admins, oder auch normale Mitglieder?
- **Warum wichtig:** Bestimmt, ob Channel-Verwaltung ein reines Admin-Recht ist. Discord erlaubt nur berechtigten Rollen die Channel-Erstellung; bei freier Mitglieder-Erstellung droht Wildwuchs.
- **Optionen:**
    - A) Nur Owner/Admin koennen Channels anlegen/loeschen/umbenennen/umordnen.
    - B) Mitglieder duerfen Channels vorschlagen, Admins genehmigen.
    - C) Jedes Mitglied darf Channels anlegen (Wildwuchs-Risiko).
- **Empfehlung:** Option A — Channel-Verwaltung ist Admin-Recht. Konsistent mit der Anforderung, dass Admins die Gruppe strukturieren. Hält das Modell einfach.
- **Entscheidung:** _offen_

### G5. [mittel] Soll beim Erstellen einer Gruppe automatisch ein Default-Channel (z.B. 'Allgemein') angelegt werden, und kann dieser geloescht werden?
- **Warum wichtig:** Ohne Default-Channel ist eine frisch erstellte Gruppe leer und nicht nutzbar. Discord/Slack erzwingen einen unloeschbaren General-Channel.
- **Optionen:**
    - A) Auto-Anlage eines 'Allgemein'-Channels bei Gruppengruendung; mindestens 1 Channel muss immer existieren (letzter nicht loeschbar).
    - B) Auto-Anlage, aber loeschbar (Gruppe darf 0 Channels haben).
    - C) Kein Auto-Channel; Admin muss manuell anlegen.
- **Empfehlung:** Option A — Default-Channel 'Allgemein' automatisch anlegen, letzten Channel nicht loeschbar. Beste UX, verhindert leere/kaputte Gruppen.
- **Entscheidung:** _offen_

### G6. [niedrig] Gibt es private/admin-only Channels INNERHALB einer Gruppe (nur fuer bestimmte Rollen sichtbar), oder sind alle Channels einer Gruppe fuer alle Mitglieder sichtbar?
- **Warum wichtig:** Private Channels (z.B. 'Admin-intern') erfordern eine zusaetzliche Berechtigungsebene pro Channel (channel.visibility / per-channel ACL), was Komplexitaet deutlich erhoeht. Nicht explizit gefordert.
- **Optionen:**
    - A) Alle Channels einer Gruppe sind fuer alle Gruppenmitglieder sichtbar (keine per-Channel-ACL). Einfach.
    - B) Channels haben ein min_role-Feld (z.B. nur admin) — einfache rollenbasierte Sichtbarkeit ohne volle ACL.
    - C) Volle per-Channel-Mitglieder-ACL wie Discord. Hoher Aufwand.
- **Empfehlung:** Option A fuer v1 (alle Mitglieder sehen alle Channels). Falls ein Admin-interner Channel gewuenscht ist, Option B (min_role-Feld pro Channel) als guenstiger Mittelweg. Volle ACL (C) ist fuer ein Studierenden-Projekt overkill.
- **Entscheidung:** _offen_

### G7. [mittel] Ist der oeffentliche Feed read-only-Broadcast (nur Admin-Posts, niemand reagiert) oder interaktiv (Kommentare und/oder Reaktionen erlaubt)? Und falls Kommentare: duerfen Nicht-Mitglieder kommentieren?
- **Warum wichtig:** Bestimmt, ob zusaetzliche Tabellen fuer Kommentare/Reaktionen noetig sind und wie das Moderationsmodell aussieht. 'Oeffentlich einsehbar' klaert nur Lesen, nicht Interaktion. Kommentare von Nicht-Mitgliedern werfen Auth-/Spam-Fragen auf.
- **Optionen:**
    - A) Reiner Broadcast: nur Admin-Posts, keine Kommentare/Reaktionen. Minimal, sauberste Trennung Feed(broadcast) vs. Channels(dialog).
    - B) Posts + Reaktionen (Emoji/Like) durch eingeloggte Nutzer, aber keine Freitext-Kommentare. Leichtes Engagement.
    - C) Posts + Kommentare + Reaktionen (interaktiv). Kommentieren nur fuer Mitglieder; Nicht-Mitglieder nur lesen.
    - D) Voll interaktiv inkl. Kommentare durch jeden eingeloggten Nutzer (auch Nicht-Mitglieder).
- **Empfehlung:** Option A oder B. Empfehlung A fuer v1: Feed = read-only Admin-Broadcast (Ankuendigungen), klar abgegrenzt von den Channels (= Dialog/Chat). Das macht die Rollen der beiden Features eindeutig. Falls Engagement gewuenscht: B (nur Reaktionen). Kommentare (C/D) erhoehen Moderationslast erheblich — erst bei klarer Anforderung.
- **Entscheidung:** _offen_

### G8. [mittel] Welche Gruppen-Metadaten sind Pflicht/optional: Name, Beschreibung, Bild/Logo, Banner, Region, Tags, Regeln/Beschreibungstext, Mitglieder-Kapazitaetsgrenze?
- **Warum wichtig:** Bestimmt die Felder der groups-Tabelle und die Anforderungen an Bild-Upload/Storage (auf Shared-Webspace ggf. heikel). Region/Tags sind fuer das Beispiel 'Flieger Trierer Umgebung' und die Entdeckung/Suche wichtig.
- **Optionen:**
    - A) Pflicht: name, slug. Optional: description, logo_image, region/Ort, tags, rules_text. Keine harte Kapazitaetsgrenze.
    - B) Wie A, aber zusaetzlich banner_image und max_members (Kapazitaetslimit).
    - C) Minimal: nur name + description.
- **Empfehlung:** Option A. region + tags sind angesichts des regionalen Beispiels und der geforderten Entdeckung/Vorschlaege wichtig und sollten dabei sein. Bild-Upload: klaeren, wo Dateien liegen (lokales public/uploads vs. Supabase Storage) — Shared-Webspace-Schreibrechte/Quota pruefen. Keine Kapazitaetsgrenze per Default (siehe naechste Frage).
- **Entscheidung:** _offen_

### G9. [niedrig] Gibt es Kapazitaetsgrenzen (max. Mitglieder pro Gruppe, max. Gruppen pro Nutzer, max. Channels pro Gruppe)?
- **Warum wichtig:** Auf billigem Shared-Webspace mit MySQL-Quota koennen unbegrenzte Gruppen/Nachrichten zu Speicher-/Performance-Problemen fuehren. Auch Missbrauchsschutz (jemand legt 1000 Gruppen an).
- **Optionen:**
    - A) Keine harten Limits in v1, nur sanfte Defaults; spaeter nachruesten.
    - B) Pragmatische Soft-Limits: z.B. max. 50 Channels/Gruppe, keine Mitgliedergrenze, Rate-Limit auf Gruppengruendung.
    - C) Harte konfigurierbare Limits ueberall.
- **Empfehlung:** Option B — keine Mitgliedergrenze (widerspraeche dem Community-Gedanken), aber pragmatische Obergrenzen fuer Channels und ein einfaches Rate-Limit/Anti-Spam auf Gruppengruendung und Nachrichten, um die Shared-DB zu schuetzen.
- **Entscheidung:** _offen_

### G10. [mittel] Wie funktioniert das Entdecken von Gruppen: Verzeichnis (Liste aller public Gruppen), Volltextsuche (Name/Beschreibung/Tags/Region), und Vorschlaege auf dem Dashboard — nach welcher Logik werden Vorschlaege berechnet?
- **Warum wichtig:** 'Vorschlaege' im Dashboard ist genannt, aber die Empfehlungslogik ist voellig offen. Eine echte Recommendation-Engine ist fuer ein Studierenden-Projekt zu viel; eine simple Heuristik reicht. Suche braucht ggf. MySQL FULLTEXT-Index.
- **Optionen:**
    - A) Verzeichnis + Suche (LIKE auf name/tags/region). Vorschlaege = simple Heuristik: gleiche Region wie Nutzer-Profil ODER beliebteste (mitgliederstaerkste) oeffentliche Gruppen, die der Nutzer noch nicht beigetreten ist.
    - B) Wie A, aber Suche via MySQL FULLTEXT-Index fuer bessere Relevanz.
    - C) Voll personalisierte Empfehlungen (Tags-Matching mit Interessen/anderen Mitgliedschaften). Hoher Aufwand.
- **Empfehlung:** Option A. Verzeichnis + einfache LIKE/Tag-Suche; Vorschlaege als simple Heuristik (Region-Match + Popularitaet, ausgenommen bereits beigetretene). Pragmatisch und gut demonstrierbar. FULLTEXT (B) nur falls Datenmenge es rechtfertigt.
- **Entscheidung:** _offen_

### G11. [hoch] Wie laeuft der Beitrittsantrag-Workflow (join request) bei 'Bewerbung um Aufnahme' genau ab — mit optionaler Begruendungsnachricht? Und der Einladungs-Workflow (invite): per direktem Nutzer-Invite, per Einladungslink/Code, oder beides?
- **Warum wichtig:** Bestimmt die Felder/Zustaende der Tabellen group_join_requests (status: pending/approved/rejected, optional message) und group_invites (Token-basierter Link vs. gerichtete Einladung an konkreten Nutzer, Ablaufdatum, Einmal-/Mehrfachnutzung). City-Rallye nutzt bereits join-links/QR — ein konsistentes Link-Muster bietet sich an.
- **Optionen:**
    - A) Join-Request: pending->approved/rejected, optionale Freitext-Begruendung; ein Admin entscheidet. Invite: gerichtete Einladung an konkreten Nutzer (per Username/Profil), Mitglied wird durch Annahme.
    - B) Wie A, Invite zusaetzlich/alternativ als Token-Einladungslink (teilbar, mit optionalem Ablauf/Max-Uses) — konsistent mit City-Rallye join-link-Muster.
    - C) Minimal: nur Join-Requests (kein gerichtetes Invite), 'privat' = jeder kann Antrag stellen, Admin genehmigt.
- **Empfehlung:** Option B. Join-Requests mit Status + optionaler Begruendung UND Invites sowohl gerichtet (an konkreten Nutzer) als auch als teilbarer Token-Link mit optionalem Ablauf/Max-Uses. Der Token-Link passt zum etablierten City-Rallye-Muster und ist fuer private Gruppen sehr praktisch. Bei Zeitknappheit Schritt 1 = gerichtete Invites + Requests, Token-Link als Erweiterung.
- **Entscheidung:** _offen_

### G12. [mittel] Welche Moderationsfunktionen sind noetig: Mitglieder entfernen (kick) vs. dauerhaft sperren (ban, Wiederbeitritt verhindern)? Nachrichten/Posts loeschen (hard delete vs. soft delete/'entfernt')? Gruppe verlassen durch Mitglied?
- **Warum wichtig:** Bestimmt zusaetzliche Felder/Tabellen (z.B. banned-Flag oder group_bans, soft-delete-Spalten deleted_at). Ban != Kick (Ban muss erneuten Beitritt/Antrag blocken). Auch: was passiert mit Inhalten eines entfernten Mitglieds?
- **Optionen:**
    - A) Voll: leave (Selbst-Austritt), kick (entfernen, Wiederbeitritt moeglich), ban (entfernen + sperren), Nachrichten/Posts soft-deleten (als 'entfernt' markiert, Audit bleibt). banned-Status in group_members oder separater group_bans-Tabelle.
    - B) Reduziert: leave + kick + Post/Message-Loeschen (hard delete), kein dauerhafter Ban.
    - C) Minimal: nur leave + Post-Loeschen durch Admin.
- **Empfehlung:** Option A mit soft-delete fuer Nachrichten/Posts (Spalte deleted_at + deleted_by), und Ban-Status als Feld in group_members (status: active/banned) statt eigener Tabelle (einfacher). Soft-delete erhaelt Thread-Konsistenz und ermoeglicht Moderations-Audit. Selbst-Austritt fuer jedes Mitglied immer erlaubt (ausser letzter Owner).
- **Entscheidung:** _offen_

### G13. [mittel] Beziehung Gruppen <-> Flugtreffen: Soll eine Gruppe ein Flugtreffen veranstalten/organisieren koennen (Flugtreffen ist optional einer Gruppe zugeordnet, nur Mitglieder sehen/nehmen teil)?
- **Warum wichtig:** Nicht gefordert, aber eine naheliegende und wertvolle Verknuepfung zweier Kern-Features. Beeinflusst, ob die flight_meets-Tabelle (andere Domaene) eine optionale group_id-FK braucht. Sollte fruehzeitig entschieden werden, da es das Flugtreffen-Schema beruehrt.
- **Optionen:**
    - A) Keine Kopplung in v1 — Gruppen und Flugtreffen sind unabhaengig. Einfachster Scope.
    - B) Optionale Kopplung: flight_meets.group_id (nullable). Eine Gruppe kann Flugtreffen 'veranstalten'; Sichtbarkeit/Teilnahme kann an Mitgliedschaft gekoppelt werden. Empfohlen als spaeteres Feature.
    - C) Tiefe Integration: Gruppen-Flugtreffen erscheinen automatisch im Gruppen-Feed/Channel, Kalender pro Gruppe etc.
- **Empfehlung:** Option B als bewusst eingeplante, aber spaeter umsetzbare Erweiterung: jetzt schon eine nullable group_id im flight_meets-Schema vorsehen (kostet fast nichts, vermeidet spaetere Migration), die UI-Integration aber als optionales Feature kennzeichnen. Diese Frage muss mit dem Verantwortlichen der Flugtreffen-Domaene abgestimmt werden.
- **Entscheidung:** _offen_

### G14. [hoch] Verhaeltnis 'Gruppen-Channels' zum genannten 'uebergreifenden Chat-System' (separate Domaene): Teilen sich beide dieselbe Nachrichten-/Chat-Infrastruktur (eine messages-Tabelle mit polymorphem Kontext) oder sind es getrennte Systeme?
- **Warum wichtig:** FlightMeet hat sowohl gruppen-interne Channels als auch ein 'uebergreifendes Chat-System' (vermutlich Direktnachrichten zwischen Piloten). Ob beide auf einer gemeinsamen messages-Tabelle aufsetzen, beeinflusst das Datenmodell domaenenuebergreifend und sollte nicht still angenommen werden.
- **Optionen:**
    - A) Gemeinsame, generische chat-Infrastruktur: eine conversations/channels-Tabelle mit Typ (group_channel | direct_message) + eine messages-Tabelle. DRY, ein Realtime-Mechanismus fuer alles.
    - B) Getrennte Systeme: group_channels/group_messages fuer Gruppen, separate Tabellen fuer DMs. Klare Domaenentrennung, etwas Redundanz.
    - C) Offen lassen bis Chat-Domaene spezifiziert ist.
- **Empfehlung:** Option A anstreben (gemeinsame Chat-Engine), ABER zwingend mit dem Verantwortlichen der uebergreifenden Chat-Domaene abstimmen, bevor das Schema fixiert wird. Ein gemeinsames Nachrichten-Backend spart erheblichen Aufwand und vereinheitlicht den (noch offenen) Realtime-Mechanismus. Bis zur Abstimmung das Gruppen-Schema so halten, dass ein spaeteres Zusammenfuehren moeglich bleibt.
- **Entscheidung:** _offen_

### G15. [niedrig] Bestaetigung: Alle nutzer-sichtbaren Strings auf Deutsch, und API-/DB-Bezeichner auf Englisch (wie im City-Rallye-Vorgaengerprojekt)?
- **Warum wichtig:** Konsistenz-Regel aus dem Vorgaengerprojekt; muss laut Arbeitsanweisung explizit bestaetigt statt still angenommen werden.
- **Optionen:**
    - A) UI-Strings Deutsch, Code/DB/API Englisch (wie City-Rallye).
    - B) Alles Deutsch inkl. API-Felder.
    - C) Alles Englisch.
- **Empfehlung:** Option A — konsistent mit City-Rallye-Konvention. Bestaetigung einholen.
- **Entscheidung:** _offen_


## Chat & Realtime-Architektur

### C1. [hoch] Welche Realtime-Architektur wählen wir, angesichts dass der Uni-Webspace keine WebSockets/SSE/langlaufenden Prozesse erlaubt, der Nutzer aber 'kein Polling' wünscht?
- **Warum wichtig:** Dies ist die fundamentalste Entscheidung des gesamten Projekts. Sie bestimmt, ob ein zweiter Backend-Stack (Supabase), eine Auth-Brücke, ein zweiter Datenspeicher und doppelte Autorisierungslogik eingeführt werden — oder ob 'kein Polling' bewusst aufgeweicht wird. Sie beeinflusst Datenmodell, API, Sicherheit und Deployment grundlegend.
- **Optionen:**
    - (A) HYBRID: Supabase (Postgres + Realtime-WebSockets) NUR als Chat-Backend; CI4+MySQL bleibt Source of Truth für alles andere (User, Treffen, Gruppen). Echtes Realtime ohne Polling, aber zwei Datenspeicher + Auth-Brücke (CI4-User <-> Supabase RLS via signiertem JWT).
    - (B) VOLL-SUPABASE: Auth+DB+Realtime+Storage komplett auf Supabase, CI4 entfällt. Technisch sauberste Realtime-Lösung, widerspricht aber dem vorgegebenen CI4/MySQL-Stack (Modul-Vorgabe) frontal.
    - (C) EXTERNER PUB/SUB: Pusher Channels oder Ably nur für Realtime-Benachrichtigung ('neue Nachricht da'), MySQL bleibt alleinige Source of Truth; CI4 schreibt Nachricht + triggert serverseitig ein Pusher-Event. Kein zweiter Datenspeicher, nur ein Pub/Sub-Dienst.
    - (D) SELBST-GEHOSTETER WS-SERVER: Soketi/Ratchet/Node auf separatem VPS. Auf dem Uni-Webspace praktisch unmöglich, bräuchte eigenen Host + Betrieb — für ein Uni-Projekt unrealistisch.
    - (E) PRAGMATISCHES POLLING: TanStack Query refetchInterval (z.B. 2-3s) auf eine schlanke /messages?since=-Route mit ETag/304, optional adaptiv (schneller bei offenem Chat, langsamer im Hintergrund). Bleibt 100% im vorgegebenen CI4/MySQL/Webspace-Stack, ist aber technisch Polling.
- **Empfehlung:** Primär-Empfehlung (C) Externer Pub/Sub (Pusher/Ably) mit MySQL als Source of Truth: erfüllt 'kein Polling' und 'direkt' echt, hält CI4/MySQL als vorgegebenen Haupt-Stack intakt, führt KEINEN zweiten Datenspeicher und KEINE Datenkonsistenz-Probleme über zwei Stores ein (anders als A), und die Autorisierung bleibt vollständig in CI4 (Private/Presence-Channel-Auth-Endpoint). Pusher/Ably haben großzügige Free-Tier-Limits, die für ein Uni-Projekt locker reichen. (A) Hybrid-Supabase ist die Zweitwahl, wenn Storage/Reactions/Presence 'out of the box' gewünscht sind und die RLS-Auth-Brücke akzeptiert wird. (E) ist der robusteste, risikoärmste Fallback und sollte als verpflichtender Plan B definiert werden (Abnahme darf nicht an einem externen Dienst hängen). (B) verletzt die Stack-Vorgabe; (D) ist unrealistisch. WICHTIG: Wenn die Demo auf dem geteilten Webspace laufen muss, ist NUR ein extern gehosteter Realtime-Dienst (C oder A) eine echte Realtime-Option — alles Selbstgehostete scheidet aus.
- **Entscheidung:** _offen_

### C2. [hoch] Wie überbrücken wir die Authentifizierung zwischen CI4-Usern und dem Realtime-Dienst (Pusher Channel-Auth bzw. Supabase RLS)?
- **Warum wichtig:** Bei (C) muss CI4 für jeden Private/Presence-Channel signieren, ob der User den Channel abonnieren darf; bei (A) braucht Supabase RLS einen vertrauenswürdigen User-Identitätsnachweis. Ohne saubere Brücke kann jeder fremde Konversationen mitlesen — direkte Sicherheitslücke.
- **Optionen:**
    - (C-Variante) CI4 stellt einen /api/realtime/auth-Endpoint bereit, der das Pusher/Ably-Channel-Auth-Signing übernimmt und dabei die Channel-Mitgliedschaft gegen MySQL (conversation_members) prüft.
    - (A-Variante) CI4 stellt ein kurzlebiges, signiertes JWT mit der CI4-user_id im 'sub'-Claim aus; Supabase verifiziert dieses JWT (custom JWT secret), RLS-Policies prüfen Mitgliedschaft.
    - Geteiltes statisches Secret / kein channelweises Auth (NICHT empfohlen — unsicher).
- **Empfehlung:** Passend zur Architektur-Wahl: bei (C) den CI4 /api/realtime/auth-Endpoint mit MySQL-Mitgliedschaftsprüfung (Standard-Pusher-Muster, gut dokumentiert, voll unter Kontrolle). Bei (A) kurzlebiges signiertes JWT + Supabase-RLS. In BEIDEN Fällen ist und bleibt CI4/MySQL die maßgebliche Autorisierungsinstanz; der Realtime-Dienst ist nur Transport.
- **Entscheidung:** _offen_

### C3. [hoch] Bei Architektur (A) Hybrid-Supabase: Wo werden Chat-Nachrichten gespeichert — nur in Supabase-Postgres oder gespiegelt in MySQL?
- **Warum wichtig:** Zwei Datenspeicher bedeuten Konsistenz- und Backup-Probleme. Wenn Nachrichten nur in Supabase liegen, hängt ein Kernfeature an einem Drittanbieter (Free-Tier-Projekte werden bei Inaktivität pausiert — eines der verbundenen Projekte ist bereits INACTIVE). Liegen sie gespiegelt in MySQL, verdoppelt sich der Schreibpfad.
- **Optionen:**
    - Nachrichten leben ausschließlich in Supabase-Postgres (Single Source für Chat, MySQL kennt nur conversation-IDs als Referenz).
    - Nachrichten werden in MySQL geschrieben UND nach Supabase repliziert (MySQL = Source of Truth, Supabase nur Realtime-Spiegel) — entspricht faktisch Option C-Charakteristik.
    - Vollständig getrennte Domänen: Chat = Supabase, Rest = MySQL, keine Spiegelung.
- **Empfehlung:** Falls (A) gewählt wird: Nachrichten ausschließlich in Supabase (sonst hat man die Nachteile von zwei Stores plus Replikationskomplexität, ohne klaren Gewinn). Falls MySQL Source of Truth bleiben soll, ist (C) die ehrlichere/einfachere Wahl als ein selbstgebauter Supabase-Spiegel. ACHTUNG Free-Tier-Pausierung: Für eine Abnahme/Demo muss das Supabase-Projekt aktiv gehalten oder kurz vorher reaktiviert werden.
- **Entscheidung:** _offen_

### C4. [hoch] Welche Chat-Features gehören in den MVP und welche werden bewusst nach hinten geschoben?
- **Warum wichtig:** Die Feature-Liste (Read-Receipts, Typing-Indikator, Online-Status, Reaktionen, Anhänge, Bearbeiten/Löschen, Erwähnungen) ist für ein Uni-Projekt zu groß. Typing-Indikator und Online-Status sind nur mit echtem Realtime sinnvoll und treiben die Architektur — sie verschärfen den 'kein Polling'-Druck.
- **Optionen:**
    - MVP schlank: Senden, History mit Pagination, Ungelesen-Zähler, Ersteller-Hervorhebung. Rest später.
    - MVP mittel: zusätzlich Read-Receipts + Reaktionen + Bearbeiten/Löschen.
    - MVP groß: zusätzlich Typing-Indikator + Online-Status + Anhänge/Bilder + Erwähnungen.
- **Empfehlung:** MVP schlank (Senden, paginierte History, Ungelesen-Zähler, Ersteller-Hervorhebung). Reaktionen und Soft-Delete/Edit als 'Phase 2'. Typing-Indikator und Online-Status (Presence) NUR aufnehmen, wenn ohnehin ein echter Realtime-Dienst (A oder C mit Presence-Channels) gewählt wurde — sonst streichen, da sie per Polling unverhältnismäßig teuer sind. Anhänge/Bilder erst nach Klärung des Storage-Wegs (siehe Risiken: Uploads auf geteiltem Webspace).
- **Entscheidung:** _offen_

### C5. [mittel] Wird der vierte Konversationstyp 'öffentlicher Gruppen-Feed' (group_feed) im MVP umgesetzt?
- **Warum wichtig:** Ein öffentlich lesbarer Feed hat andere Autorisierungs-Semantik (jeder darf lesen, nur Mitglieder/Owner schreiben) als private Konversationen und beeinflusst RLS/Channel-Auth-Policies und das conversation_members-Modell.
- **Optionen:**
    - Ja, als vollwertiger Typ im conversations.type-Enum von Anfang an.
    - Nein, vorerst nur group_channel | meetup | direct; group_feed später ergänzen.
    - Streichen — Gruppen-Channel deckt den Bedarf bereits ab.
- **Empfehlung:** Im Datenmodell den type als erweiterbares Enum/String anlegen (group_feed-fähig), aber im MVP NICHT implementieren. So bleibt das Schema offen, ohne MVP-Scope und Autorisierungs-Sonderfälle aufzublähen.
- **Entscheidung:** _offen_

### C6. [niedrig] Sollen Nutzer einander blockieren können (für Direktnachrichten)?
- **Warum wichtig:** Blockieren ist eine soziale Sicherheitsfunktion mit eigener Tabelle und Filterlogik in jedem DM-Sende-/Lese-Pfad. Es ist nicht explizit gefordert ('Blockieren?' steht selbst als Frage in der Anforderung).
- **Optionen:**
    - Ja, mit user_blocks-Tabelle und Durchsetzung beim DM-Erstellen/Senden.
    - Nein, für MVP weglassen (Meldefunktion ggf. später).
    - Nur 'Konversation stummschalten/archivieren' statt echtem Blockieren.
- **Empfehlung:** Für ein Uni-Projekt im MVP weglassen, aber als bekannte Lücke dokumentieren. Falls eine Moderations-/Sicherheitsanforderung besteht, ist eine einfache user_blocks-Tabelle der saubere Weg.
- **Entscheidung:** _offen_

### C7. [mittel] Wie wird eine 1:1-Direktkonversation eindeutig identifiziert/gefunden, damit nicht doppelte DM-Konversationen zwischen denselben zwei Nutzern entstehen?
- **Warum wichtig:** Ohne deterministische Identität öffnen zwei Nutzer, die sich gleichzeitig anschreiben, zwei getrennte Konversationen. Das erzeugt verwirrende, gespaltene Verläufe.
- **Optionen:**
    - Deterministischer dm_key = min(user_a,user_b)+'_'+max(user_a,user_b) als UNIQUE-Spalte auf conversations für type=direct.
    - Lookup über conversation_members (find-or-create per Query in einer Transaktion).
    - Client errechnet/sortiert IDs und ruft find-or-create-Endpoint auf.
- **Empfehlung:** Deterministischer, UNIQUE-indizierter dm_key auf der conversations-Tabelle plus serverseitiges 'find-or-create' in einer Transaktion. Verhindert Race-Conditions und Duplikate zuverlässig.
- **Entscheidung:** _offen_

### C8. [mittel] Wie funktioniert die History-Pagination?
- **Warum wichtig:** Bestimmt API-Form und Index-Strategie. Offset-Pagination bricht bei gleichzeitig eintreffenden neuen Nachrichten (Verschiebung); Cursor-Pagination ist robuster, aber etwas aufwändiger.
- **Optionen:**
    - Keyset/Cursor-Pagination nach (created_at, id) absteigend, 'before'-Cursor für älteres Nachladen.
    - Offset/Limit-Pagination (einfacher, aber instabil bei Live-Inserts).
    - Seitenbasiert mit fixer Seitengröße.
- **Empfehlung:** Keyset/Cursor-Pagination ('before=<message_id|timestamp>', limit=N). Robust gegen neu eintreffende Nachrichten und performant mit Index auf (conversation_id, id).
- **Entscheidung:** _offen_

### C9. [niedrig] Bestätigung: Bleibt die Vorgänger-Konvention 'SQL wird per phpMyAdmin von Hand ausgeführt, keine CI4-Migrations auf Prod' auch für FlightMeet gültig?
- **Warum wichtig:** Beeinflusst, ob das Chat-Datenmodell als CI4-Migration oder als handgepflegtes SQL-Skript (/sql) geliefert wird. Inkonsistenz hier führt zu Drift zwischen lokal und Prod.
- **Optionen:**
    - Ja, weiterhin handgepflegte SQL-Skripte unter /sql (wie City-Rallye).
    - Nein, jetzt CI4-Migrations verwenden (sauberer, aber auf geteiltem Webspace per spark schwer ausführbar).
    - Hybrid: Migrations lokal als Quelle, exportiertes SQL für Prod.
- **Empfehlung:** Konvention beibehalten (handgepflegtes SQL unter /sql), da der geteilte Webspace kein bequemes 'spark migrate' auf Prod erlaubt — konsistent mit dem Vorgänger-Projekt. Migrations lokal optional als Entwicklungs-Komfort.
- **Entscheidung:** _offen_

### C10. [niedrig] Bestätigung der Sprachregel: Alle nutzer-sichtbaren Strings auf Deutsch?
- **Warum wichtig:** Aus dem Vorgänger-Projekt übernommen, laut Aufgabe explizit zu bestätigen. Betrifft alle UI-Texte, Fehlermeldungen und ggf. Enum-Anzeigewerte.
- **Optionen:**
    - Ja, durchgängig Deutsch (Code-Bezeichner/Enums bleiben Englisch).
    - Zweisprachig (i18n) — Overhead für Uni-Projekt vermutlich unnötig.
- **Empfehlung:** Bestätigen: nutzer-sichtbare Strings Deutsch, technische Bezeichner (Tabellen, Enums, API-Felder) Englisch — wie im Vorgänger-Projekt.
- **Entscheidung:** _offen_


## Frontend-Architektur & UX

### FE1. [hoch] TypeScript oder bei Vanilla JSX bleiben?
- **Warum wichtig:** TS gibt Typsicherheit über die API-Grenze (CI4 liefert untypisiertes JSON), End-to-End-Typen via Zod-Inferenz und bessere Autovervollständigung für DaisyUI/TanStack-Query. Nachträgliche Migration ist teurer als ein sauberer Start. Steht im Spannungsfeld zu Team-Kenntnisstand und Abgabefrist.
- **Optionen:**
    - Vanilla JSX beibehalten (Status quo, geringste Einstiegshürde)
    - Voll auf TypeScript migrieren (rename .jsx->.tsx, tsconfig, typescript-eslint)
    - Inkrementell: neue Dateien in TS, allowJs:true, schrittweise Migration
    - JSDoc-Typen + checkJs (Typprüfung ohne .ts-Dateien)
- **Empfehlung:** TypeScript einführen, am besten jetzt (Projekt ist quasi leer — nur App.jsx/main.jsx). @types/react sind bereits installiert. Größter Hebel ist die typsichere API-Grenze in Kombination mit Zod (z.infer als Single Source of Truth für Formular- und Server-Typen). Falls Team-TS-Kenntnis schwach: inkrementell mit allowJs.
- **Entscheidung:** _offen_

### FE2. [hoch] Wie wird Realtime-Chat OHNE Polling im Frontend angebunden — angesichts des WebSocket-untauglichen Webspace?
- **Warum wichtig:** Dies ist DIE architekturbestimmende Frontend-Frage. Sie entscheidet, ob es einen Realtime-Connection-Store (Zustand) gibt, ob TanStack Query nur Cache/History hält, und ob ein zweiter Backend-Stack (Supabase-Client) ins Frontend kommt. 'Direkt, kein Polling' ist auf dem CI4/Shared-Webspace nativ nicht erfüllbar.
- **Optionen:**
    - Supabase Realtime (WebSocket) direkt aus dem Frontend für Chat; CI4 bleibt für Rest-API — Hybrid-/BaaS-Ansatz (echtes 'kein Polling')
    - TanStack Query mit refetchInterval (Polling) — widerspricht dem Brief, aber webspace-konform und wie im Vorgängerprojekt erprobt
    - Long-Polling/SSE gegen CI4 testen — riskant, historisch nicht lauffähig
    - Externer Realtime-Dienst (z.B. Pusher/Ably free tier) nur fürs Chat-Signalling
- **Empfehlung:** Realistisch und brief-konform: Supabase Realtime NUR für Chat (Nachrichten-Stream + Presence/Tippt-gerade) via @supabase/supabase-js im Frontend, CI4 für alles andere. Klar als bewusste Architektur-Ausnahme dokumentieren (zweiter Stack = Komplexität, Auth-Bridging). Fallback bei Ablehnung: TanStack-Query-Polling mit kurzem Intervall — dann muss der Brief-Anspruch 'kein Polling' abgeschwächt werden. Diese Entscheidung MUSS vor dem State-Design getroffen werden.
- **Entscheidung:** _offen_

### FE3. [hoch] Wie sieht die konkrete Routen-Tabelle aus und welche Routen sind geschützt (Auth-Guard)?
- **Warum wichtig:** Routing-Struktur, Layout-Routen und Guards bestimmen die gesamte Navigations- und Daten-Lade-Architektur. Ohne Festlegung entstehen Inkonsistenzen (z.B. ist Flugtreffen-Liste öffentlich oder nur für Eingeloggte?).
- **Optionen:**
    - Öffentlich: /, /flugtreffen, /flugtreffen/:id, /gruppen, /gruppen/:id, /profil/:userId, /login, /register; Geschützt: /flugtreffen/neu, /flugtreffen/:id/bearbeiten, /gruppen/neu, /chat, /chat/:conversationId, /profil (eigenes), /einstellungen; Catch-all: * -> 404
    - Alles hinter Login (Community nur für Mitglieder)
    - Alles öffentlich lesbar, nur Schreib-Aktionen geschützt
- **Empfehlung:** Variante 1 (Lesen großteils öffentlich, Schreiben/Chat/Profil-Edit geschützt) via <ProtectedRoute>-Wrapper, der bei fehlendem Token auf /login?redirect=... leitet. Layout-Routen: <RootLayout> (Navbar/Footer) für öffentliche Seiten, optional <AppShellLayout> mit Bottom-Nav für eingeloggte mobile Ansicht. React Router 7 (Data Router, createBrowserRouter) mit basename='/public/' in Prod (import.meta.env.BASE_URL nutzen).
- **Entscheidung:** _offen_

### FE4. [hoch] Wird der React-Router basename korrekt aus dem /public/-Base-Pfad abgeleitet?
- **Warum wichtig:** In Prod läuft die App unter .../public/. Ohne basename brechen Client-Routing, Deep-Links und Asset-URLs. Häufige Fehlerquelle bei Subpath-Deployments.
- **Optionen:**
    - basename={import.meta.env.BASE_URL} an createBrowserRouter/RouterProvider übergeben (vite setzt BASE_URL aus 'base')
    - Hardcoded '/public/' — fragil, bricht bei Domain-Wechsel
    - Root-.htaccess so umbauen, dass App unter / läuft (kein /public/-Prefix)
- **Empfehlung:** basename aus import.meta.env.BASE_URL ableiten — automatisch '/' im Dev und '/public/' im Build, ohne Duplizierung. Zusätzlich klären, ob die Root-.htaccess-301-Weiterleitung auf /public/ dauerhaft gewollt ist oder ob die App sauberer unter der Domain-Wurzel laufen soll (schönere URLs, aber Eingriff in CI4-DocRoot).
- **Entscheidung:** _offen_

### FE5. [hoch] Klare State-Leitlinie: Was gehört in Zustand vs. TanStack Query?
- **Warum wichtig:** Ohne Trennlinie landen Server-Daten doppelt in beiden Schichten (Bugs, Stale-Daten). Die Aufteilung ist Best-Practice-relevant und muss verbindlich sein.
- **Optionen:**
    - Server-Daten ausschließlich TanStack Query (Cache, Invalidation, Optimistic Updates); Zustand nur für Client-/UI-State (Auth-Token+User, Theme/Dark-Mode, geöffnete Modals/Drawer, Realtime-Connection-Objekt, Karten-Viewport, Toast-Queue falls nötig)
    - Alles in Zustand (kein TanStack Query) — verschenkt Caching
    - Redux Toolkit statt Zustand+Query — nicht im vorgegebenen Stack
- **Empfehlung:** Strikte Trennung: TanStack Query = alle Remote-/Server-Daten (Flugtreffen, Gruppen, Profile, Chat-History). Zustand = Auth (Token+User, persist via localStorage), UI-State, und der Realtime-Verbindungs-Handle (z.B. Supabase-Channel). Eingehende Realtime-Nachrichten werden über queryClient.setQueryData in den Query-Cache gemerged, statt einen parallelen Message-Store zu pflegen.
- **Entscheidung:** _offen_

### FE6. [hoch] Wie wird Authentifizierung im Frontend gehalten (Token-Storage, Refresh, Header-Injection)?
- **Warum wichtig:** Bestimmt API-Client-Design, ProtectedRoute, und ob das Frontend XSS-Risiken beim Token-Storage eingeht. .htaccess reicht bereits Bearer-Header durch (passt zu localStorage-Token).
- **Optionen:**
    - Opaker Bearer-Token im localStorage (wie Vorgängerprojekt), per fetch-Wrapper als Authorization-Header injiziert
    - httpOnly-Cookie-Session (sicherer gg. XSS, aber CI4 müsste Sessions/CSRF auf Shared-Webspace bedienen)
    - Supabase-Auth (JWT) falls Supabase ohnehin fürs Chat kommt — ein Auth-System für alles
- **Empfehlung:** Konsistent zum bestätigten Vorgänger-Muster: opaker Bearer-Token im localStorage, zentral in einem fetch-Wrapper injiziert, Auth-User+Token im persistierten Zustand-Store. WENN Supabase fürs Chat kommt, prüfen ob dessen JWT als EINZIGES Auth-System dient (vermeidet zwei Identitäten / Token-Bridging) — sonst entsteht erheblicher Mehraufwand. 401-Handling im Wrapper -> Logout + Redirect.
- **Entscheidung:** _offen_

### FE7. [mittel] Projektstruktur in frontend/src: feature-basiert oder layer-basiert?
- **Warum wichtig:** Beeinflusst Wartbarkeit und Auffindbarkeit über das gesamte Projekt; nachträgliches Umstellen ist teuer.
- **Optionen:**
    - Feature-basiert: src/features/{flugtreffen,gruppen,chat,profil,auth}/ je mit components/hooks/api/types; plus src/shared (ui, lib, api-client), src/app (router, providers)
    - Layer-basiert: src/components, src/pages, src/hooks, src/api, src/stores
    - Hybrid: features/ für Domänen + components/ui für generische DaisyUI-Wrapper
- **Empfehlung:** Feature-basiert (features/flugtreffen, gruppen, chat, profil, auth) mit gemeinsamem shared/ (api-client, ui-Primitives, lib/format) und app/ (Router, QueryClientProvider, ThemeProvider). Skaliert besser mit den 4 klaren Domänen aus der Navigation und hält Realtime-/Chat-Code isoliert.
- **Entscheidung:** _offen_

### FE8. [mittel] DaisyUI-Theme/Branding: Welche Farbwelt und Dark-Mode-Strategie?
- **Warum wichtig:** Branding ('FlightMeet'/Gleitschirm/Himmel) und Dark Mode betreffen jede Komponente; früh festzulegen vermeidet späteres Re-Theming.
- **Optionen:**
    - Custom DaisyUI-Theme 'flightmeet' (Himmelblau/Sonnenorange-Akzent) + 'flightmeet-dark', Umschaltung via data-theme + Zustand, Default 'system' (prefers-color-scheme)
    - Eingebaute DaisyUI-Themes (z.B. 'cupcake'/'night') ohne Custom-Branding
    - Nur Light-Mode (Scope reduzieren)
- **Empfehlung:** Ein Custom-Theme-Paar (light/dark) im Gleitschirm-/Himmel-Stil, Default = System-Präferenz, manueller Toggle im Zustand-Store persistiert. Dark Mode lohnt sich besonders, weil Piloten die App draußen/abends am Startplatz nutzen.
- **Entscheidung:** _offen_

### FE9. [mittel] i18n: Deutsche Strings hardcoden oder react-i18next einführen?
- **Warum wichtig:** Bestimmt, ob jeder Text durch eine Übersetzungsfunktion läuft. Bei reinem De-Projekt ist i18n-Lib oft Overhead, aber zentralisiert Strings und Datums-/Zahlformate.
- **Optionen:**
    - Deutsch hardcoden (einfachste Lösung, da nur eine Sprache) + Intl/date-fns mit de-Locale für Datum/Zeit
    - react-i18next mit de-Namespace (zentrale Strings, zukunftssicher für EN)
    - Leichtgewichtiges eigenes Dictionary-Objekt ohne Lib
- **Empfehlung:** Für ein deutschsprachiges Studierendenprojekt: Strings hardcoden (Deutsch), KEIN react-i18next-Overhead — ABER Datum/Zeit konsequent über Intl.DateTimeFormat('de-DE') bzw. date-fns/locale/de zentralisieren. Falls Mehrsprachigkeit erklärtes Ziel wäre, dann i18next; das bitte explizit bestätigen.
- **Entscheidung:** _offen_

### FE10. [niedrig] Welche Toaster-/Notification-Bibliothek (nicht vorgegeben)?
- **Warum wichtig:** Für Feedback bei Aktionen (Teilnahme bestätigt, Fehler, neue Chat-Nachricht) braucht es eine konsistente Lösung; Auswahl betrifft UX überall.
- **Optionen:**
    - sonner (modern, schlank, gutes Stacking, gute DaisyUI-Koexistenz)
    - react-hot-toast (etabliert, minimal)
    - DaisyUI-Alert + eigener Toast-Store in Zustand (keine Extra-Dependency)
- **Empfehlung:** sonner — moderne API, Promise-Toasts (passt zu TanStack-Mutations), barrierearm. Alternativ react-hot-toast. Eigenbau nur, wenn Dependency-Minimalismus Vorgabe ist.
- **Entscheidung:** _offen_

### FE11. [mittel] Karten-Bibliothek: react-leaflet — bestätigt, und welcher Tile-Provider?
- **Warum wichtig:** Flugtreffen haben Startplatz-Koordinaten; Karte ist UX-zentral. Tile-Provider hat Nutzungs-/Attributierungs-Auflagen (OSM) bzw. API-Key-Bedarf (Mapbox).
- **Optionen:**
    - react-leaflet + OpenStreetMap-Tiles (kostenlos, Attribution nötig, fair-use)
    - react-leaflet + MapTiler/Mapbox (API-Key, schöner, Free-Tier-Limit)
    - Keine interaktive Karte, nur statische Koordinaten-Anzeige (Scope-Reduktion)
- **Empfehlung:** react-leaflet mit OSM-Tiles für MVP (kein Key, kostenlos). Marker pro Flugtreffen, ein Marker-Cluster bei Übersicht. API-Key-Provider nur, wenn höhere Tile-Limits/Optik nötig. Karten-Komponente lazy-loaden (Leaflet ist relativ groß).
- **Entscheidung:** _offen_

### FE12. [mittel] Markdown-Rendering für nutzergenerierte Texte (Gruppenbeschreibung, Chat?) — mit Sanitizing?
- **Warum wichtig:** Wenn Beschreibungen/Chat Markdown erlauben, ist XSS-Schutz Pflicht. Ungesäubertes dangerouslySetInnerHTML ist ein Sicherheitsloch.
- **Optionen:**
    - react-markdown (rendert ohne raw HTML -> standardmäßig XSS-sicher) + remark-gfm
    - react-markdown + rehype-raw + rehype-sanitize (falls eingebettetes HTML nötig)
    - Kein Markdown — nur Plaintext mit Zeilenumbrüchen (sicherste, einfachste Option)
- **Empfehlung:** Falls Markdown gewünscht: react-markdown + remark-gfm OHNE rehype-raw (kein Roh-HTML => kein XSS). Für Chat-Nachrichten eher Plaintext + Auto-Linkify, kein volles Markdown (Performance/Sicherheit). Bitte klären, wo Markdown überhaupt erlaubt sein soll.
- **Entscheidung:** _offen_

### FE13. [niedrig] PWA/Offline-Support — im Scope oder nicht?
- **Warum wichtig:** Im Vorgängerprojekt war vite-plugin-pwa enthalten. Piloten am Startplatz haben schlechtes Netz; Offline-Fähigkeit hätte echten Nutzen, kostet aber Komplexität (Service-Worker, Cache-Strategie, Update-Flow).
- **Optionen:**
    - vite-plugin-pwa mit installierbarem Manifest + Offline-Shell + Caching der GET-API (read-only offline)
    - Nur installierbares Web-App-Manifest, KEIN Offline-Caching (leichter)
    - Kein PWA (Scope reduzieren, Fokus auf Pflicht-Features)
- **Empfehlung:** Für den Use-Case (mobile Nutzung draußen, schlechtes Netz) ist mindestens das installierbare Manifest sinnvoll; volles Offline-Caching nur, wenn Zeit bleibt. Realtime-Chat und Offline beißen sich konzeptionell — Offline daher primär für Lese-Ansichten (Flugtreffen-Liste). Als bewusste Scope-Entscheidung bestätigen.
- **Entscheidung:** _offen_

### FE14. [mittel] Mobile-First-Layout: Bottom-Navigation oder klassische Top-Navbar?
- **Warum wichtig:** Hauptnutzung ist mobil (Handy am Startplatz). Navigationsmuster prägt das gesamte Layout und die Daumen-Erreichbarkeit.
- **Optionen:**
    - Mobile: DaisyUI btm-nav (Bottom-Tabbar: Home/Flugtreffen/Gruppen/Chat) + Desktop: Top-Navbar; responsive Umschaltung
    - Durchgehend Top-Navbar mit Hamburger-Drawer auf Mobile
    - Nur Drawer/Sidebar
- **Empfehlung:** Mobile-First mit Bottom-Tabbar (genau die 4 Menüpunkte Home/Flugtreffen/Gruppen/Chat) auf kleinen Viewports und Top-Navbar ab md. Daumenfreundlich, passt zum Outdoor-Mobile-Use-Case.
- **Entscheidung:** _offen_

### FE15. [hoch] Formular-Validierung: React Hook Form mit Zod-Resolver verbindlich, und welche Regeln pro Formular?
- **Warum wichtig:** Validierungsregeln müssen definiert werden (Pflichtfelder, Datums-Logik, Längen) und idealerweise mit Backend-Validierung gespiegelt sein. Zod ist im Stack 'optional' — Entscheidung nötig.
- **Optionen:**
    - React Hook Form + @hookform/resolvers/zod, Zod-Schemas als geteilte Quelle für Typen+Validierung
    - React Hook Form mit eingebauter Validierung (register-rules), ohne Zod
    - Nur HTML5-Validierung (unzureichend)
- **Empfehlung:** React Hook Form + Zod-Resolver verbindlich machen (begründet die TS-Empfehlung via z.infer). Pro Formular Regeln definieren: Login/Register (E-Mail-Format, Passwort-Mindestlänge, Passwort-Bestätigung), Flugtreffen-Neu (Titel Pflicht, Datum in der Zukunft, gültige Koordinaten/Startplatz, max. Teilnehmer optional >0), Gruppe-Neu (Name eindeutig, Beschreibung Längenlimit), Profil (Anzeigename, Bio-Länge, Avatar-Bildtyp/-größe), Chat (nicht leer, Längenlimit). Fehlermeldungen auf Deutsch.
- **Entscheidung:** _offen_

### FE16. [mittel] Optimistic Updates: für welche Aktionen?
- **Warum wichtig:** Optimistic UI verbessert die gefühlte Performance (besonders mobil/langsames Netz), erhöht aber Komplexität (Rollback bei Fehler).
- **Optionen:**
    - Optimistic für 'Teilnehmen/Absagen' an Flugtreffen, Gruppe beitreten/verlassen und Chat-Senden; alles andere normal
    - Überall optimistic (komplex, fehleranfällig)
    - Keine Optimistic Updates (einfacher, aber träger)
- **Empfehlung:** Gezielt optimistic via TanStack Query onMutate/Rollback für: Teilnahme-Toggle, Gruppen-Beitritt, Chat-Nachricht-senden (Pending-Bubble). Für komplexe Create-/Edit-Formulare normales Mutate + Toast. Konsequent Empty-/Error-/Loading-States und Skeletons (DaisyUI skeleton) definieren.
- **Entscheidung:** _offen_

### FE17. [niedrig] Framer Motion: Wo werden Transitions eingesetzt (und reduced-motion respektieren)?
- **Warum wichtig:** Animationen prägen die wahrgenommene Qualität; übertrieben kosten sie Performance/Barrierefreiheit. Festlegen, wo sinnvoll.
- **Optionen:**
    - Gezielt: Seitenwechsel (AnimatePresence am Router-Outlet), Modal/Drawer Ein-/Ausblenden, Toast-Eintritt, Card-Hover/Tap, Karten-Marker-Pop, Chat-Bubble-Eintritt; prefers-reduced-motion respektieren
    - Nur Seitenübergänge
    - Keine Animationen (Scope/Performance)
- **Empfehlung:** Gezielter Einsatz an genau diesen Stellen, mit useReducedMotion-Guard. Mobile-Performance beachten (keine schweren Layout-Animationen in langen Listen — stattdessen einfache Fade/Slide).
- **Entscheidung:** _offen_

### FE18. [mittel] Bestätigung: Bleiben deutsche UI-Strings die verbindliche Regel?
- **Warum wichtig:** Brief markiert dies explizit zur Bestätigung. Falsche Annahme zöge sich durch alle Komponenten.
- **Optionen:**
    - Ja, alle nutzer-sichtbaren Strings Deutsch (wie Vorgängerprojekt)
    - Englisch
    - Zweisprachig (zieht react-i18next nach sich)
- **Empfehlung:** Beibehalten: alle nutzer-sichtbaren Strings Deutsch, Datum/Zeit de-DE. Konsistent mit dem bestätigten Vorgänger-Standard.
- **Entscheidung:** _offen_


## Backend, Datenmodell-Gesamt & Deployment

### B1. [hoch] Gibt es SSH-Zugang zum Uni-Webspace (hosting.wi1cm.uni-trier.de), oder nur SFTP/lftp?
- **Warum wichtig:** Entscheidet die gesamte Migrations- und Seed-Strategie auf Prod. Ohne SSH kann 'spark migrate' dort nicht laufen; Schema muss per SQL-Dump ueber phpMyAdmin eingespielt werden. Mit SSH waere ein sauberer migrate-Workflow moeglich.
- **Optionen:**
    - Nur SFTP/lftp (Annahme laut Deploy-Skripten) -> Migrations lokal entwickeln, Schema als SQL-Dump exportieren und per phpMyAdmin auf Prod importieren
    - SSH vorhanden -> 'php spark migrate' direkt auf dem Server ausfuehren
    - Hybrid: SSH nur fuer einmaliges Setup, danach kein laufender Zugriff
- **Empfehlung:** Realistisch ist 'nur SFTP'. Empfehlung: CI4-Migrations als Single Source of Truth lokal pflegen, fuer Prod ein reproduzierbares SQL-Dump via 'php spark db:create'/mysqldump generieren und per phpMyAdmin importieren. Migrations NICHT aufgeben — sie bleiben die Schema-Wahrheit, der Dump ist nur das Deployment-Artefakt.
- **Entscheidung:** _offen_

### B2. [hoch] Wie wird der Realtime-Chat realisiert, wenn der geteilte Webspace keine WebSockets/SSE/langlaufenden Prozesse erlaubt — CI4-only oder Supabase?
- **Warum wichtig:** Zentrale Architekturweiche. 'Kein Polling' ist auf dem Host mit reinem CI4 praktisch nicht erfuellbar. Supabase loest Realtime sauber, fuehrt aber einen zweiten Backend-Stack (Postgres neben MySQL) plus Auth-Token-Bruecke und potenzielle Datenduplikation ein.
- **Optionen:**
    - Supabase nur fuer Chat (Postgres+Realtime), CI4/MySQL bleibt SoT fuer alles andere — Chat-Tabellen leben in Supabase
    - Supabase als komplettes BaaS (Auth+DB+Storage+Realtime), CI4 nur noch fuer wenige Eigenlogiken — grosser Architekturbruch
    - CI4-only mit Long-Polling/HTTP-Polling (pragmatisch, aber verletzt 'kein Polling')
    - CI4-only mit SSE — scheitert vermutlich am Host (langlaufende Verbindungen)
- **Empfehlung:** Supabase NUR fuer den Chat (Option 1): Chat ist die einzige echte Realtime-Anforderung. messages/conversations/message_reads in Supabase-Postgres, alles andere bleibt in CI4/MySQL. Auth-Bruecke ueber ein vom CI4 ausgestelltes JWT, das Supabase Realtime/RLS akzeptiert (gemeinsames Secret). Damit bleibt MySQL Single Source of Truth fuer Domaenendaten, und nur Chat-Nachrichten werden bewusst in Supabase gehalten (keine Duplikation, klare Grenze).
- **Entscheidung:** _offen_

### B3. [hoch] Welcher Auth-Mechanismus wird im Backend durchgesetzt — stateless JWT oder CI4-Session/DB-Token?
- **Warum wichtig:** Bestimmt CI4-Filter-Design, Stateless-Faehigkeit, und ob ein Token an Supabase weitergereicht werden kann. JWT laesst sich an Supabase RLS bruecken; reine CI4-Sessions nicht.
- **Optionen:**
    - Stateless JWT (eigene Klasse oder firebase/php-jwt), validiert in einem CI4-Filter pro /api-Request
    - CI4-Session-basiert (Cookie), Session-Storage Datei oder DB
    - Opaque Token in DB-Tabelle 'personal_access_tokens', pro Request gegen DB geprueft
- **Empfehlung:** Stateless JWT mit kurzer Lebensdauer + Refresh, validiert in einem CI4-Before-Filter ('auth'), der user_id in den Request injiziert. Begruendung: same-origin macht CSRF beherrschbar, JWT ist die natuerliche Bruecke zu Supabase-RLS (falls Chat dort liegt), und es vermeidet DB-Roundtrips pro Request auf dem connection-limitierten Host. Token im HttpOnly-Cookie ablegen (XSS-sicher), nicht im localStorage.
- **Entscheidung:** _offen_

### B4. [hoch] Wo werden Datei-Uploads (Profilbilder, Chat-Anhaenge, Gruppen-Logos) gespeichert?
- **Warum wichtig:** writable/ ist nicht oeffentlich erreichbar, public/ wird beim Frontend-Build teilweise ueberschrieben, und der Host limitiert upload_max_filesize/post_max_size. Supabase Storage waere eine Alternative, fuehrt aber wieder den zweiten Stack ein.
- **Optionen:**
    - public/media/uploads/ (oeffentlich, direkt per URL erreichbar; muss in vite emptyOutDir-Ausnahme bleiben und ausserhalb des Build-Outputs liegen)
    - writable/uploads/ + CI4-Controller streamt Dateien ueber /media-Route (zugriffskontrolliert, aber CPU/Memory pro Download)
    - Supabase Storage (CDN, Zugriffskontrolle via Policies) — nur sinnvoll falls Supabase ohnehin fuer Chat genutzt wird
- **Empfehlung:** public/media/uploads/ fuer oeffentliche, unkritische Bilder (Profil-/Gruppen-Avatare) — performant, kein PHP im Pfad. Verzeichnis ausserhalb des Vite-Build-Outputs anlegen, damit 'npm run build' es nicht beruehrt. Fuer Chat-Anhaenge (potenziell privat) ueber CI4 zugriffskontrolliert streamen ODER, falls Chat in Supabase liegt, Supabase Storage nutzen. Bilder serverseitig mit CI4 Image-Lib (GD) auf max. Kantenlaenge verkleinern, EXIF strippen, nur Whitelist-MIME (jpeg/png/webp) zulassen, zufaellige Dateinamen.
- **Entscheidung:** _offen_

### B5. [niedrig] API-Versionierung: /api/v1 oder /api ohne Version?
- **Warum wichtig:** Versionierung erhoeht spaeter Flexibilitaet, kostet aber bei einem Studierendenprojekt etwas Overhead. Muss vor Implementierung der Routing-Gruppen entschieden werden.
- **Optionen:**
    - /api/v1/... von Anfang an (Routing-Gruppe in Routes.php)
    - /api/... ohne Version (einfacher, fuer ein Uni-Projekt ausreichend)
- **Empfehlung:** /api/v1 als Routing-Gruppe. Minimaler Mehraufwand, wirkt professionell in der Abgabe und kostet nur eine geschachtelte group() in Routes.php. Vite-Proxy '/api' deckt das bereits ab.
- **Entscheidung:** _offen_

### B6. [mittel] Einheitliches Response-Envelope-Format oder rohe Ressourcen-Bodies?
- **Warum wichtig:** TanStack Query im Frontend profitiert von vorhersehbaren Shapes; ein Envelope mit {data, error, meta} vereinfacht Fehlerbehandlung und Pagination clientseitig.
- **Optionen:**
    - Envelope {data, error, meta} fuer ALLE Antworten (auch Fehler)
    - Rohe Ressource bei Erfolg, separates {error}-Objekt bei Fehler (REST-pur, CI4 ResponseTrait-Default)
    - JSON:API-Spezifikation (zu schwergewichtig fuer den Scope)
- **Empfehlung:** Schlankes Envelope: Erfolg {data, meta?}, Fehler {error:{code,message,fields?}}, immer mit korrektem HTTP-Statuscode. Implementiert in einer BaseController-Methode (respondSuccess/respondError) auf Basis von CI4 ResponseTrait. Pagination-Infos (page,total,perPage) in meta.
- **Entscheidung:** _offen_

### B7. [mittel] CI4 ResourceController/ResourcePresenter vs. eigene BaseApiController-Klasse?
- **Warum wichtig:** ResourceController gibt CRUD-Konventionen vor (index/show/create/update/delete), eigene Controller geben mehr Kontrolle ueber das Envelope und Nicht-CRUD-Aktionen (z.B. /meetups/{id}/join).
- **Optionen:**
    - Durchgaengig CI4 ResourceController (api:resource-Routing)
    - Eigener BaseApiController (extends Controller) mit ResponseTrait + Envelope-Helpern
    - Mischform: ResourceController fuer reine CRUD-Ressourcen, eigene Controller fuer Aktionsendpunkte
- **Empfehlung:** Mischform mit gemeinsamem BaseApiController: ResponseTrait + Envelope + Auth-Helper zentral, CRUD-Ressourcen erben davon. Nicht-CRUD-Aktionen (join/leave/accept) als explizite Routen. Vermeidet Magie und bleibt erklaerbar in der Abgabe.
- **Entscheidung:** _offen_

### B8. [mittel] Wird Deutsch fuer alle nutzersichtbaren Strings verbindlich uebernommen, und wo liegen die Texte (DB-Inhalte vs. UI-Labels)?
- **Warum wichtig:** Betrifft DB-Spaltenwerte (z.B. Enum-Labels, Default-Texte), Seed-Daten und API-Fehlermeldungen. Konsistenz zwischen Backend-Fehlern und UI noetig.
- **Optionen:**
    - Deutsch ueberall, auch API-Fehlermeldungen (message-Feld deutsch)
    - Deutsch nur im UI, API-Fehler in englischen Codes + deutsche UI-Mapping-Tabelle
    - Zweisprachig via CI4 Language-Files / i18n
- **Empfehlung:** API liefert stabile englische error.code-Werte (maschinenlesbar) PLUS deutschen error.message (anzeigbar). UI mappt primaer auf code, faellt auf message zurueck. Seed-/Domaenendaten (Meetup-Titel, Spot-Namen) deutsch. Kein volles i18n noetig fuer den Scope.
- **Entscheidung:** _offen_

### B9. [niedrig] Wie werden CI4-Sessions gespeichert, falls ueberhaupt benoetigt (Datei vs. DB)?
- **Warum wichtig:** Auf geteiltem Webspace kann das Dateisystem fuer Sessions langsam/eingeschraenkt sein; bei stateless JWT entfaellt der Bedarf weitgehend.
- **Optionen:**
    - Keine Server-Sessions (rein stateless JWT) — bevorzugt
    - FileHandler in writable/session/
    - DatabaseHandler (ci_sessions-Tabelle in MySQL)
- **Empfehlung:** Stateless JWT => keine Server-Sessions noetig. Falls doch (z.B. CSRF-Token bei Formular-Posts), DatabaseHandler statt File, da writable/ auf dem geteilten Host weniger verlaesslich ist. Konsistent mit der JWT-Auth-Empfehlung.
- **Entscheidung:** _offen_

### B10. [hoch] Polymorphe Chat-Kontexte: Eine zentrale conversations-Tabelle mit Typ-Diskriminator oder getrennte Tabellen pro Kontext (DM/Gruppe/Meetup)?
- **Warum wichtig:** Der Chat ist 'uebergreifend' (DMs, Gruppen-Channels, ggf. Meetup-Chats). Ein polymorphes Schema haelt Messages einheitlich, erschwert aber FK-Integritaet.
- **Optionen:**
    - conversations(type, context_id) polymorph + messages(conversation_id) — eine Nachrichten-Tabelle
    - Getrennte Tabellen direct_messages/group_messages — Duplikation der Message-Logik
    - conversations als 'Container', verknuepft optional 1:1 mit group_channel/meetup, plus participants-Tabelle fuer DMs
- **Empfehlung:** Polymorphe conversations(type ENUM('direct','group','meetup'), context_id NULLABLE) + conversation_participants + messages + message_reads. Eine Message-Tabelle, ein Read-Modell, ein Realtime-Kanal. context_id verweist je nach type auf group/meetup (kein harter FK, in Applikationslogik durchgesetzt). Falls Chat in Supabase: identisches Schema dort, RLS auf participant-Mitgliedschaft.
- **Entscheidung:** _offen_

### B11. [mittel] Soll TanStack Query/Frontend-Pagination cursor- oder offset-basiert bedient werden, besonders fuer Chat-Verlauf und Feeds?
- **Warum wichtig:** Offset-Pagination ist auf MySQL bei tiefen Seiten langsam; Chat-Verlauf braucht stabile Cursor (created_at,id). Beeinflusst Index-Design.
- **Optionen:**
    - Offset/Limit ueberall (einfach)
    - Cursor-basiert (keyset) fuer Messages/Feeds, Offset fuer kleine Listen
    - Cursor ueberall
- **Empfehlung:** Keyset/Cursor-Pagination fuer messages und feed_posts (WHERE (created_at,id) < cursor ORDER BY ... LIMIT n) mit passendem Composite-Index; Offset fuer kleine, beschraenkte Listen (z.B. Gruppenmitglieder). Reduziert Last auf dem connection-limitierten Host.
- **Entscheidung:** _offen_


---

## Identifizierte Lücken (von keinem Domänen-Analysten abgedeckt)

- **L1.** Benachrichtigungen/Notifications: KEINE Analyse deckt ab, wie Nutzer über neue Chat-Nachrichten, Beitrittsanfragen, Einladungen, Flugtreffen-Erinnerungen oder Feed-Posts informiert werden, wenn sie NICHT im jeweiligen View sind. In-App-Notification-Center, Badge-Counts global, ggf. E-Mail/Push. Eng verknüpft mit der Realtime- und SMTP-Frage.

- **L2.** DSGVO/Datenschutz ganzheitlich: Nur punktuell erwähnt (Soft-Delete in Auth/Gruppen). Es fehlt: Datenschutzerklärung, Cookie-/Consent-Banner (relevant bei Drittanbietern wie Pusher/Supabase/OSM-Tiles, die IP-Adressen sehen), Auftragsverarbeitung mit Supabase/Pusher (US-Anbieter, Drittlandtransfer!), Recht auf Auskunft/Export/Löschung als Nutzer-Feature, Aufbewahrungsfristen für Chat-Logs.

- **L3.** Impressum & rechtliche Pflichtangaben (DE): Für eine in Deutschland betriebene Community-Plattform mit nutzergeneriertem Inhalt sind Impressum (§5 DDG/TMG) und Datenschutzerklärung Pflicht. Keine Analyse erwähnt dies.

- **L4.** Globale Moderation & Meldesystem über alle Domänen: Auth nennt Admin-Sperre, Gruppen nennt gruppen-interne Moderation — aber es fehlt ein plattformweites 'Inhalt/Nutzer melden'-Feature (Profile, Bios, Chat-Nachrichten, Feed-Posts, Flugtreffen) mit Report-Queue und globaler Admin-Moderationsoberfläche. Bei nutzergeneriertem Content rechtlich/praktisch relevant.

- **L5.** Tests & Qualitätssicherung: phpunit ist installiert (composer.json), aber keine Analyse definiert eine Teststrategie (Backend: Feature-Tests für Auth/Autorisierung/Race-Conditions; Frontend: Komponententests/Vitest). Für ein 'fortgeschrittene Webentwicklung'-Modul bewertungsrelevant.

- **L6.** Barrierefreiheit (a11y): Außer einem useReducedMotion-Hinweis (Frontend) fehlt Barrierefreiheit komplett — Tastaturbedienung, Fokus-Management in Modals/Drawer/Chat, ARIA für Live-Regions (neue Chat-Nachrichten), Kontraste im Custom-Theme, Screenreader-Labels.

- **L7.** Onboarding & Empty States für Erst-Nutzer: Was sieht ein frisch registrierter Nutzer mit 0 Gruppen/0 Flugtreffen/0 Chats? Profil-Setup-Flow, Erstvorschläge, leere Dashboards. Frontend nennt Empty-States generisch, aber kein durchgängiges Onboarding-Konzept.

- **L8.** Suche global/übergreifend: Suche ist pro Domäne gelöst (Flugtreffen, Gruppen), aber eine globale Suche (Nutzer + Gruppen + Flugtreffen) und insbesondere die Nutzersuche zum DM-Start ist nur am Rand erwähnt. @-Mentions im Chat (in Auth angedeutet) sind nirgends ausgearbeitet.

- **L9.** Karten-/Geo-Datenquelle als Projektrisiko: Flugtreffen-Domäne benennt zwar die Koordinaten-Frage, aber es fehlt projektweit, WER die kuratierte spots-Tabelle mit echten Gleitschirm-Startplätzen + Koordinaten befüllt und pflegt (Seed-Daten-Aufgabe). Ohne diese Daten ist die Kartenansicht leer.

- **L10.** Audit-Logging/Nachvollziehbarkeit von Admin-Aktionen: Wer hat wen gesperrt, welchen Post gelöscht, welche Beitrittsanfrage abgelehnt? Soft-Delete-Felder (deleted_by) sind erwähnt, aber kein konsistentes Audit-Konzept.

- **L11.** Performance-/Last-Budget des geteilten Hosts: Verbindungslimits, gleichzeitige Polling-Clients, MySQL-Quota werden je Domäne als Risiko genannt, aber es fehlt ein gemeinsames, konkretes Budget/Limit-Konzept (max. Polling-Intervall, Rate-Limits projektweit).


## Widersprüche zwischen Domänen (aufzulösen)

- **W1.** KERN-WIDERSPRUCH: Anforderung 'performanter, direkter Chat OHNE Polling' vs. geteilter Uni-Webspace, der historisch KEINE WebSockets/SSE/langlaufenden Prozesse erlaubt. Alle sechs Analysen benennen dies als Showstopper. Mit reinem CI4/MySQL auf diesem Host ist echtes Push technisch unmöglich — es gibt nur drei Wege: (a) externen Realtime-Dienst akzeptieren (Pusher/Ably/Supabase), (b) Polling akzeptieren und den 'kein Polling'-Anspruch bewusst aufweichen, oder (c) Demo NICHT auf dem Uni-Webspace laufen lassen. Diese Entscheidung ist nicht getroffen und blockiert das Chat-Schema.

- **W2.** Realtime-Lösungsempfehlung divergiert zwischen den Analysten: Chat-Domäne empfiehlt primär einen externen Pub/Sub (Pusher/Ably) MIT MySQL als alleiniger Source of Truth (kein zweiter Datenspeicher); Backend, Frontend und Auth empfehlen Supabase NUR für Chat (Postgres als zweiter Datenspeicher für Nachrichten); Gruppen empfiehlt als sicheren Default schlicht Polling. Es gibt also keinen Konsens über DIE Realtime-Architektur, nur Konsens über das Problem.

- **W3.** Chat-Nachrichten-Datenhaltung widersprüchlich: Bei der Supabase-Variante (Backend/Frontend/Auth) lägen Nachrichten in Postgres und damit ein Kernfeature bei einem Drittanbieter (ein verbundenes Free-Tier-Projekt ist bereits INACTIVE/pausiert) — Konflikt mit dem von Chat/Backend geforderten Prinzip 'MySQL bleibt Single Source of Truth'. Pusher/Ably (Chat-Empfehlung) vermeidet das, da nur Signalling extern läuft und Nachrichten in MySQL bleiben.

- **W4.** Auth-Token-Speicherung widersprüchlich: Auth-Domäne und Frontend empfehlen opaque Bearer Token in localStorage (Konsistenz zum Vorgängerprojekt City-Rallye), Backend empfiehlt explizit ein HttpOnly-JWT-Cookie (XSS-sicherer). Beide nennen die jeweils andere Variante als Trade-off (localStorage=XSS-Risiko, Cookie=CSRF-Aufwand). Nicht aufgelöst.

- **W5.** Auth-Token-Format widersprüchlich: Auth-Domäne präferiert opaque, in DB nachschlagbare Token (einfache Revocation); Backend präferiert stateless JWT (keine DB-Roundtrips, natürliche Brücke zu Supabase-RLS). Die Wahl hängt direkt an der Realtime-Entscheidung — JWT nur nötig/sinnvoll, wenn eine Supabase-RLS-Brücke gebaut wird.

- **W6.** Chat-Schema-Granularität widersprüchlich: Gruppen-Domäne modelliert eigenständige group_channels/group_messages-Tabellen, während Chat- und Backend-Domäne eine gemeinsame polymorphe conversations/messages-Engine für alle Chat-Orte fordern. Beide Seiten markieren dies als abstimmungsbedürftig; ohne Auflösung droht doppelte Infrastruktur.

- **W7.** Auth-Library widersprüchlich: Auth-Domäne empfiehlt bevorzugt CodeIgniter Shield (offizielles Paket, Access-Tokens + Groups), Backend skizziert dagegen Eigenbau-JWT-Filter + eigene Token/Tabellen ohne Shield. Shield bringt eigene Tabellen/Konventionen mit, die mit dem skizzierten Eigenbau-Schema kollidieren würden.

- **W8.** 'home_spot' als Datenschutz-Risiko teils widersprüchlich behandelt: Auth-Domäne stuft den genauen Heimat-Spot als sensibel/privat ein (nicht in öffentlicher Profilkarte), während Backend home_spot_id als reguläres Profilfeld führt und Flugtreffen Spots öffentlich auf der Karte zeigt. Sichtbarkeitsregel für Standortdaten muss vereinheitlicht werden.

