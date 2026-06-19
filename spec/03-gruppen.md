# Gruppen / Communities

Communities sind dauerhafte, themen- oder regionsbezogene Zusammenschlüsse von Piloten. Eine Gruppe
bündelt drei Bausteine, die strikt getrennt autorisiert werden:

1. **Öffentlicher Feed** — read-only Broadcast, nur Owner/Admins posten, je nach `visibility` auch für
   Nicht-Mitglieder/anonym lesbar (`feed_posts`, ADR-006).
2. **Channels** — dialogischer Chat *intern* für Mitglieder; technisch Zeilen der **einen polymorphen
   Chat-Engine** `conversations` mit `type='group_channel'` (ADR-005, **keine** `group_channels`/
   `group_messages`-Tabellen).
3. **Mitgliedschaft & Rollen** — `group_members` als maßgebliche Autorisierungstabelle für REST (BOLA-Schutz).

Verbindliche Tabellen-/Feldnamen siehe `DATA_MODEL.md` §5 (Gruppen) und §7 (Chat). Dieses Kapitel ist die
funktionale Spezifikation darüber. Nutzersichtbare Labels Deutsch, technische Keys/`error.code` Englisch
(Querschnitt „Enum-/Sprach-Konvention").

---

## 1. Sichtbarkeit × Beitritt — die zwei orthogonalen Achsen

Zwei **getrennte** Felder auf `groups` (ADR-006), die NICHT in ein Enum gepresst werden:

- **`visibility ∈ {public, private, unlisted}`** — *wer die Gruppe und ihren Feed sieht.*
- **`join_policy ∈ {open, request, invite_only}`** — *wie man Mitglied wird.*

Default neuer Gruppen: `visibility=public`, `join_policy=open`.

### 1.1 `visibility` — Sichtbarkeit (3 Werte)

| Key | Label | Im Verzeichnis (`GET /groups`)? | Detail/Metadaten lesbar? | **Feed** lesbar für Nicht-Mitglieder? | Channels lesbar? |
|---|---|---|---|---|---|
| `public` | Öffentlich | **ja**, gelistet & suchbar | ja, für alle | **ja** (anonym + eingeloggt) | nur Mitglieder |
| `unlisted` | Nicht gelistet | **nein** (nicht gelistet/gesucht) | ja, **nur per Link/slug** | **ja** (wer den Link hat) | nur Mitglieder |
| `private` | Privat | **nein** | nur Mitglieder; sonst reduzierte „Existenz-/Beitritts-Karte" | **nein** (nur Mitglieder) | nur Mitglieder |

**Wichtig (ADR-006):** Feed-Sichtbarkeit und Channel-Sichtbarkeit sind **getrennt** zu autorisieren. Channels
sind in **jeder** `visibility` nur für Mitglieder lesbar; der Feed folgt der Tabelle oben. Bei `private`
sieht ein Nicht-Mitglied weder Feed noch Mitgliederliste — nur Name, Logo, Beschreibung und einen
Beitritts-CTA (sofern `join_policy` einen Weg erlaubt).

### 1.2 `join_policy` — Beitritt (3 Werte)

| Key | Label | Beitrittsweg | Tabelle | Erfolgs-Ergebnis |
|---|---|---|---|---|
| `open` | Offen | `POST /groups/{id}/members` → Direktbeitritt | `group_members` | sofort `role=member, status=active` |
| `request` | Auf Anfrage | `POST /groups/{id}/join-requests` → Admin genehmigt | `group_join_requests` | bei `approved` → `group_members` |
| `invite_only` | Nur mit Einladung | gerichtete Einladung **oder** Token-Link | `group_invites` | bei Annahme → `group_members` |

### 1.3 Verhaltensmatrix `visibility` × `join_policy` (9 Kombinationen)

Wie ein **Nicht-Mitglied** die Gruppe wahrnimmt und welcher Beitritts-CTA erscheint:

| | `open` | `request` | `invite_only` |
|---|---|---|---|
| **`public`** | Gelistet, Feed öffentlich. CTA „Beitreten" → sofort Mitglied. *(Default)* | Gelistet, Feed öffentlich. CTA „Beitritt anfragen" (+ optionale Begründung). | Gelistet, Feed öffentlich. **Kein** Selbst-Beitritt; Hinweis „Beitritt nur per Einladung". Direktaufruf eines Token-Links tritt bei. |
| **`unlisted`** | Nur per Link auffindbar, Feed öffentlich lesbar. CTA „Beitreten" → sofort. | Nur per Link, Feed lesbar. CTA „Beitritt anfragen". | Nur per Link, Feed lesbar. Beitritt ausschließlich per Einladung/Token. |
| **`private`** | Nicht auffindbar; Feed/Channels verborgen. Direkt-Beitritt über bekannten Link technisch offen → CTA „Beitreten". *Hinweis: `private`+`open` ist erlaubt (ADR-012/B3), aber ungewöhnlich → UI warnt beim Anlegen.* | Nicht auffindbar; reduzierte Karte. CTA „Beitritt anfragen". | **Häufigster Privat-Fall.** Nur über Einladung/Token sichtbar & beitretbar. |

> **✅ Entschieden (ADR-012/B3):** `private`+`open` ist **erlaubt** (Achsen bleiben orthogonal); die UI **warnt** beim Anlegen — **kein** Validierungsverbot.
> Default-Vorschlag: erlauben (Achsen bleiben orthogonal), aber im Formular mit Hinweis „Jeder mit dem Link
> kann sofort beitreten" kennzeichnen.

**Banned-Sonderfall (übergreifend):** Ein Nutzer mit `group_members.status='banned'` ist von **jedem**
Beitrittsweg ausgeschlossen — `open`-Beitritt, `request` und Invite-/Token-Annahme liefern `403
group_member_banned`. Ban wird vor allen Beitritts-Transaktionen geprüft.

---

## 2. Rollen & Berechtigungsmatrix

### 2.1 Gruppen-Rollen (`group_members.role`)

Vier Rollen, hierarchisch (`owner > admin > moderator > member`). Diese **gruppen-lokalen** Rollen sind
unabhängig von der **Plattform-Rolle** (Shield-Group `user`/`admin`, ADR-004): ein Plattform-`admin` ist
nicht automatisch Gruppen-Admin (außer über Moderations-Override, §6.4).

| Key | Label | Anzahl/Gruppe | Kernkompetenz |
|---|---|---|---|
| `owner` | Eigentümer | **genau 1** | volle Kontrolle inkl. Gruppe löschen, Eigentum übertragen |
| `admin` | Administrator | 0..n | Gruppe strukturieren: Metadaten, Channels, Feed, Mitglieder/Anträge/Einladungen |
| `moderator` | Moderator | 0..n | Inhalte moderieren (fremde Channel-Posts löschen, Mitglieder kicken/bannen) — **keine** Struktur-/Metadaten-Hoheit |
| `member` | Mitglied | 0..n | lesen, in Channels posten, Feed lesen |

### 2.2 Berechtigungsmatrix

✓ = erlaubt · ✗ = verboten · (eig.) = nur eigene Inhalte · — = nicht anwendbar

| Aktion | Nicht-Mitglied | `member` | `moderator` | `admin` | `owner` |
|---|---|---|---|---|---|
| **Discovery** | | | | | |
| Verzeichnis sehen (public) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Feed lesen (gem. §1.1) | (vis.) | ✓ | ✓ | ✓ | ✓ |
| **Beitritt** | | | | | |
| Direkt beitreten (`open`) | ✓ | — | — | — | — |
| Beitritt anfragen (`request`) | ✓ | — | — | — | — |
| Einladung/Token annehmen | ✓ | — | — | — | — |
| Gruppe verlassen | — | ✓ | ✓ | ✓ | ✗ (nur nach Transfer) |
| **Channels (Chat)** | | | | | |
| Channel lesen (`min_role` beachten) | ✗ | ✓ (member-Channels) | ✓ | ✓ | ✓ |
| In Channel posten | ✗ | ✓ | ✓ | ✓ | ✓ |
| Eigene Nachricht edit/del (Soft) | ✗ | ✓ (eig.) | ✓ (eig.) | ✓ (eig.) | ✓ (eig.) |
| **Fremde** Nachricht löschen (Soft) | ✗ | ✗ | ✓ | ✓ | ✓ |
| Channel anlegen | ✗ | ✗ | ✗ | ✓ | ✓ |
| Channel umbenennen/umordnen | ✗ | ✗ | ✗ | ✓ | ✓ |
| Channel löschen (nicht Default) | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Feed** | | | | | |
| Feed-Post erstellen | ✗ | ✗ | ✗ | ✓ | ✓ |
| Feed-Post edit/pin | ✗ | ✗ | ✗ | ✓ | ✓ |
| Feed-Post löschen (Soft) | ✗ | ✗ | ✓ (Moderation) | ✓ | ✓ |
| **Mitglieder-Management** | | | | | |
| Mitgliederliste sehen | (vis.) | ✓ | ✓ | ✓ | ✓ |
| Mitglied kicken | ✗ | ✗ | ✓ | ✓ | ✓ |
| Mitglied bannen/entbannen | ✗ | ✗ | ✓ | ✓ | ✓ |
| Rolle ändern (promote/demote) | ✗ | ✗ | ✗ | ✓ (bis `moderator`) | ✓ (bis `admin`) |
| Eigentum übertragen | ✗ | ✗ | ✗ | ✗ | ✓ |
| **Anträge / Einladungen** | | | | | |
| Anträge sehen/entscheiden | ✗ | ✗ | ✗ | ✓ | ✓ |
| Einladung/Token erstellen | ✗ | ✗ | ✗ | ✓ | ✓ |
| Einladung widerrufen | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Gruppe** | | | | | |
| Metadaten bearbeiten | ✗ | ✗ | ✗ | ✓ | ✓ |
| Gruppe löschen (Soft) | ✗ | ✗ | ✗ | ✗ | ✓ |

**Rollen-Vergabe-Invarianten (app-seitig erzwungen):**
- Ein `admin` kann höchstens bis `moderator` befördern und keinen `admin`/`owner` herabstufen.
- Nur `owner` darf `admin` vergeben/entziehen und Eigentum übertragen.
- Niemand kann sich selbst befördern; niemand kann den `owner` kicken/bannen/demoten (außer dem System
  beim Eigentums-Transfer).
- Moderation richtet sich nie gegen eine ranghöhere Rolle (ein `moderator` kann keinen `admin`/`owner`
  kicken; ein `admin` keinen `owner`).

> **Querschnitt (BOLA-Schutz):** Jeder Check läuft serverseitig über einen zentralen Authorization-Helper
> (`can(user, action, group)`) im `BaseApiController`, der `group_members` (Rolle + `status`) lädt — niemals
> nur im React-Frontend (ADR-004, Querschnitt „Serverseitige Autorisierung"). React-Gates sind reine UX.

---

## 3. Channels (= `conversations` type=`group_channel`)

Channels sind **keine** eigene Tabelle: ein Channel = eine Zeile in `conversations` mit
`type='group_channel'`, `context_type='group'`, `context_id=groups.id` (ADR-005). Channel-Metadaten leben
direkt auf `conversations`: `title` (Channel-Name), `position` (Sortierung), `is_default`, `min_role`.
Nachrichten laufen über die gemeinsame `messages`-Tabelle; das gesamte Chat-Verhalten (Senden, Keyset-
Pagination, Reaktionen, Soft-Edit/Delete, Ungelesen via `last_read_message_id`) ist in der Chat-Domäne
spezifiziert (ADR-009). **Dieses Kapitel** definiert nur das *Gruppen-spezifische* Verhalten.

### 3.1 Default-Channel
- Beim **Gründen** einer Gruppe wird automatisch ein Default-Channel **„Allgemein"** angelegt
  (`is_default=1`, `position=0`, `min_role='member'`).
- Der Default-Channel ist **nicht löschbar**. Allgemeiner gilt die Invariante: der **letzte** Channel einer
  Gruppe ist nicht löschbar (verhindert kaputte/leere Gruppen). Beide werden app-seitig erzwungen
  (`409 last_channel_not_deletable` / `409 default_channel_not_deletable`).

### 3.2 Channel-Verwaltung
- Channels anlegen/umbenennen/umordnen/löschen ist **Admin-Recht** (`admin`/`owner`; `moderator` nicht).
- **Umordnen:** über `position` (PATCH). Lückenlose Reihenfolge ist nicht erforderlich; Sortierung
  client-seitig nach `position, id`.
- **Löschen:** Soft-Delete (`conversations.deleted_at`); Nachrichten bleiben erhalten (Moderations-Audit),
  werden aber nicht mehr ausgeliefert.

### 3.3 Admin-interne Channels (`min_role`)
- `min_role ∈ {member, admin}`. Default `member` (alle Mitglieder sehen/posten).
- `min_role='admin'` macht einen Channel **admin-intern**: nur `admin`/`owner` sehen und schreiben ihn;
  `member`/`moderator` sehen ihn weder in `GET /groups/{id}/channels` noch dürfen sie lesen/schreiben
  (`403 channel_role_required`).
- **✅ Entschieden (ADR-012/B4):** `moderator` hat **keinen** Zugriff auf `admin`-Channels. `min_role` kennt nur die Stufen `member`/`admin`; nur `owner`/`admin` sehen und schreiben Admin-Channels.

---

## 4. Öffentlicher Feed (`feed_posts`)

Der Feed ist ein **read-only Admin-Broadcast** (Ankündigungen, ADR-006) — klar abgegrenzt von den
dialogischen Channels.

### 4.1 Verhalten
- **Posten:** nur `owner`/`admin` (`author_user_id` MUSS owner/admin sein, serverseitig geprüft).
  `moderator` und `member` posten **nicht** in den Feed.
- **Lesen:** richtet sich nach `visibility` (§1.1) — bei `public`/`unlisted` auch für **Nicht-Mitglieder/
  anonym** lesbar; bei `private` nur Mitglieder.
- **Felder:** `title?`, `body` (Pflicht), `image_path?` (ein Bild), `is_pinned`. Body-Format wie Bio:
  eingeschränktes Markdown mit doppeltem Sanitizing beim Rendern (ADR-011) — **kein** rohes HTML.
- **Anpinnen:** `is_pinned=true` hebt einen Post oben an; mehrere Pins erlaubt (sortiert: gepinnt zuerst,
  dann `created_at DESC`).
- **Pagination:** Keyset über `(group_id, created_at, id)` (Cursor, kein OFFSET — Polling-Last, ADR-001).
- **Soft-Delete:** `deleted_at`/`deleted_by`; gelöschte Posts verschwinden aus dem Read (kein Tombstone im
  Feed, anders als bei Chat-Nachrichten).

### 4.2 Verhältnis Feed ↔ Channels

| | **Feed** (`feed_posts`) | **Channels** (`conversations`/`messages`) |
|---|---|---|
| Zweck | Ankündigungen/Broadcast | Dialog/Chat |
| Wer schreibt | nur `owner`/`admin` | alle Mitglieder (gem. `min_role`) |
| Wer liest | je `visibility` (auch extern) | nur Mitglieder |
| Richtung | one-to-many (Broadcast) | many-to-many (Konversation) |
| Realtime | Polling 15–30 s (Liste) | Polling 2–3 s (aktiver Channel) |
| Tabelle | `feed_posts` | `conversations` + `messages` |

Sie sind **konzeptionell und in der UI getrennt**: Feed = Außendarstellung/Aushang; Channels = interner
Austausch.

### 4.3 Feed-Interaktivität: Emoji-Reaktionen (ADR-012/B2)
Der Feed ist **Broadcast** (nur Admin-Posts). **Emoji-Reaktionen sind im MVP** (ADR-012/B2) über die
Tabelle `feed_post_reactions` (DATA_MODEL §5.4.1): **eingeloggte** Nutzer können auf Feed-Posts reagieren
(Toggle, ein Emoji pro Nutzer/Post); Gäste sehen den Feed read-only.

**Kommentare** bleiben bewusst **nicht im MVP** — ein Kommentar-Thread zöge Moderation, Soft-Delete-
Tombstones und Benachrichtigungen nach sich. Das `conversations`-Enum hält `type='group_feed'` weiterhin
vorbereitet, wird aber nicht genutzt; der Feed läuft über `feed_posts` (+ `feed_post_reactions`).

---

## 5. Beitritt — Anträge & Einladungen

### 5.1 Antrag (`group_join_requests`, `join_policy=request`)
1. Nutzer stellt Antrag: `POST /groups/{id}/join-requests` mit optionaler `message` (≤ 500 Zeichen).
2. `status='pending'`. UNIQUE `(group_id, user_id, status)` verhindert mehrere **offene** Anträge
   (app-seitig zusätzlich „nur ein `pending`" erzwingen).
3. Owner/Admin sieht offene Anträge (`GET .../join-requests`), entscheidet per `PATCH .../{requestId}`:
   - `approved` → in **einer Transaktion**: `group_members`-Eintrag (`role=member`, `status=active`)
     anlegen, `members_count++`, `decided_by`/`decided_at` setzen, Notification
     `group_request_approved` an Antragsteller.
   - `rejected` → Status setzen, optionale Notification.
4. Antragsteller kann selbst `cancelled` setzen (zieht `pending`-Antrag zurück).
5. Neue Anträge erzeugen Notification `group_join_request` an Owner/Admins.

**Übergangsdiagramm `status`:** `pending → approved | rejected | cancelled` (terminal). Re-Antrag nach
`rejected` ist möglich (neuer Datensatz), sofern nicht `banned`.

### 5.2 Einladung (`group_invites`) — gerichtet ODER Token-Link
Eine Tabelle, zwei Modi (`join_policy=invite_only`, aber auch für `request`/`open` als Direkteinladung
nutzbar):

**(a) Gerichtete Einladung** — `invited_user_id` gesetzt, `token=NULL`:
- Owner/Admin lädt konkreten Nutzer ein → Notification `group_invite`.
- Annahme/Ablehnung durch den eingeladenen Nutzer; Annahme erzeugt `group_members`-Eintrag (Transaktion).

**(b) Teilbarer Token-Link** — `token` gesetzt (UNIQUE, kryptografisch zufällig, `VARCHAR(64)`),
`invited_user_id=NULL`:
- Optional `expires_at` und `max_uses` (NULL = unbegrenzt), `uses_count` (Default 0).
- `GET /invites/{token}` liefert **Vorschau** (Gruppenname/Logo/Beschreibung) vor Annahme — ohne Auth.
- `POST /invites/{token}/accept` (auth) löst ein: prüft Gültigkeit in Transaktion
  (`status='pending'` ∧ `expires_at` nicht überschritten ∧ `uses_count < max_uses` ∧ Nutzer nicht bereits
  Mitglied/`banned`), erzeugt `group_members`, inkrementiert `uses_count`. Bei erschöpftem/abgelaufenem
  Link `410 invite_expired` bzw. `409 invite_exhausted`.

**Status-Enum:** `pending | accepted | declined | revoked | expired`. `expired` wird im **Read** aus
`expires_at < NOW()` abgeleitet (kein Cron, ADR-002/Querschnitt) — nicht per Scheduler persistiert.
`revoked` setzt Owner/Admin aktiv (`DELETE .../invites/{inviteId}`).

> **Race-Sicherheit (Querschnitt „Datenintegrität"):** Alle Beitritts-Pfade erzeugen `group_members` unter
> `UNIQUE(group_id, user_id)` + Transaktion. Doppel-Beitritt (z.B. parallel Antrag genehmigt + Token
> eingelöst) führt zu `409 already_member`, nicht zu Duplikaten. `members_count` wird in derselben
> Transaktion gepflegt.

---

## 6. Entdeckung, Moderation, Metadaten

### 6.1 Entdeckung (Discovery)
- **Verzeichnis** `GET /groups`: listet `public`-Gruppen (nicht `unlisted`/`private`), mit Paginierung.
- **Suche** `?q=`: einfache `LIKE`-Suche über `name`/`description`; **Filter** `?region=`, `?tags=`
  (FULLTEXT nur falls Datenmenge es rechtfertigt — Default `LIKE`).
- **Dashboard-Vorschläge** `GET /groups/suggestions`: einfache Heuristik = **Region-Match**
  (`groups.region == profiles.home_region`) **+ Popularität** (`members_count DESC`), **ohne** bereits
  beigetretene Gruppen. Liefert wenige (z.B. 5) Vorschläge.
- `unlisted` erscheint nie im Verzeichnis/in der Suche — nur per `slug`/Link auffindbar.

### 6.2 Basis-Moderation
- **Mitglied entfernen (kick):** `DELETE /groups/{id}/members/{userId}` durch `moderator`/`admin`/`owner`
  (nie gegen ranghöhere Rolle). Entfernt `group_members`-Zeile, `members_count--`. Erneuter Beitritt
  möglich (es sei denn gebannt).
- **Bannen/Entbannen:** `PATCH .../members/{userId}` setzt `status='banned'` (bzw. zurück auf `active`).
  Ban = Mitgliedschaftszeile bleibt mit `status='banned'`, blockiert alle Beitrittswege (§1.3).
- **Post/Nachricht löschen = Soft-Delete:** Feed-Posts (`feed_posts.deleted_at`/`deleted_by`) und Channel-
  Nachrichten (`messages.deleted_at`/`deleted_by`, Tombstone-Anzeige im Chat). **Kein** Hard-Delete →
  Thread-Konsistenz + Audit (Querschnitt „Soft-Delete", ADR-008/009).
- Ein Report-/Melde-Workflow ist **nicht im MVP** (ADR-008) — nur diese direkten Admin-Aktionen.

### 6.3 Selbst-Austritt
- Jedes Mitglied darf jederzeit austreten (`DELETE .../members/{self}` = „leave"), **außer** der `owner`:
  der letzte Owner muss zuerst das Eigentum übertragen (`409 owner_must_transfer`). Invariante „genau ein
  Owner" (DATA_MODEL §5.1).

### 6.4 Plattform-Admin-Override
Ein Plattform-`admin` (Shield-Group, ADR-004) darf zu Moderationszwecken auch ohne Gruppen-Mitgliedschaft
Gruppen/Feed-Posts/Nachrichten soft-löschen. **Umfang (ADR-012, Moderation deferred):** nur Soft-Delete
von Inhalten bzw. Gruppe löschen, **keine** Inhalts-Erstellung im Namen der Gruppe. Ein dedizierter
Report-/Moderations-Workflow ist nicht im MVP (ADR-008).

### 6.5 Gruppen-Metadaten
| Feld | Pflicht? | Quelle/Format |
|---|---|---|
| `name` | **Pflicht** | `VARCHAR(120)` |
| `slug` | auto | aus `name` generiert, UNIQUE; lesbare URL `/gruppen/{slug}` |
| `description` | optional | `TEXT`, eingeschränktes Markdown + Sanitizing (ADR-011) |
| `logo_path` | optional | **Upload** (s.u.) |
| `region` | optional | für Entdeckung/Vorschläge |
| `tags` | optional | `JSON`-Array (Default) bzw. `group_tags` (optional, nur falls Facetten-Suche) |
| `rules_text` | optional | `TEXT`, Markdown + Sanitizing |
| `visibility` / `join_policy` | Pflicht (mit Defaults) | §1 |

**Banner:** Das Dossier nannte „Logo/Banner". **✅ Entschieden (ADR-012/C3):** nur `logo_path`, **kein**
Banner im MVP (kein `banner_path`); bei Bedarf analoge Upload-Spalte nachrüstbar.

**Bild-Upload (Querschnitt):** Logo nach `public/media/uploads/groups/` (außerhalb des Vite-Build-Outputs),
serverseitige Validierung: MIME-Whitelist (jpeg/png/webp), Größenlimit, EXIF strippen, Resizing via GD,
randomisierter Dateiname. Schreibrechte/Quota früh auf dem echten Webspace testen; sonst externe URL-
Referenz. Keine Kapazitätsgrenze für Mitglieder (Default); pragmatische Obergrenze für Channels + leichtes
Rate-Limit auf Gruppengründung/Nachrichten zum Schutz der Shared-DB.

### 6.6 Gruppe ↔ Flugtreffen (ADR-012/B5: nicht im MVP)
**✅ Entschieden (ADR-012/B5):** Im MVP gibt es **keine** Gruppe↔Treffen-Verknüpfung. Die Spalten
`meetups.group_id` (NULLABLE, `ON DELETE SET NULL`) und `meetups.visibility='group'` bleiben als
**vorbereitetes, ungenutztes** Schema (alle Treffen `visibility='public'`); die UI-Integration ist
ohne Migration nachrüstbar.

---

## 7. API-Endpunkte

Alle unter `/api/v1`. Auth via HttpOnly-Session-Cookie + CSRF-Header (ADR-004). Autorisierung pro Objekt
serverseitig (BOLA). Fehler als `{ "error": { "code": "<english_key>", "message": "<deutsch>" } }`.

### 7.1 Gruppen & Discovery
| Methode | Pfad | Auth | Zweck |
|---|---|---|---|
| `GET` | `/groups` | optional | Verzeichnis (nur `public`); `?q=&region=&tags=&page=` |
| `GET` | `/groups/suggestions` | erforderlich | Dashboard-Vorschläge (Region + Popularität, ohne eigene) |
| `POST` | `/groups` | erforderlich | Gründen; Ersteller→`owner`; legt Default-Channel „Allgemein" an |
| `GET` | `/groups/{slug}` | optional | Detail/Metadaten (Umfang gem. `visibility` + Mitgliedschaft) |
| `PATCH` | `/groups/{id}` | admin/owner | Metadaten ändern (name, description, logo, region, tags, rules, visibility, join_policy) |
| `DELETE` | `/groups/{id}` | owner | Gruppe soft-löschen |

### 7.2 Feed
| Methode | Pfad | Auth | Zweck |
|---|---|---|---|
| `GET` | `/groups/{id}/feed` | optional (gem. `visibility`) | Feed lesen (Keyset `?before=`); auch Nicht-Mitglieder/anonym bei public/unlisted |
| `POST` | `/groups/{id}/feed` | admin/owner | Feed-Post erstellen |
| `PATCH` | `/groups/{id}/feed/{postId}` | admin/owner | bearbeiten / `is_pinned` |
| `DELETE` | `/groups/{id}/feed/{postId}` | moderator+ | Soft-Delete |

### 7.3 Channels & Channel-Nachrichten
| Methode | Pfad | Auth | Zweck |
|---|---|---|---|
| `GET` | `/groups/{id}/channels` | Mitglied | Channels listen (gefiltert nach `min_role`) |
| `POST` | `/groups/{id}/channels` | admin/owner | Channel anlegen (`conversations type=group_channel`) |
| `PATCH` | `/groups/{id}/channels/{channelId}` | admin/owner | umbenennen/umordnen (`position`)/`min_role` |
| `DELETE` | `/groups/{id}/channels/{channelId}` | admin/owner | Soft-Delete (nicht Default/letzter) |
| `GET` | `/channels/{channelId}/messages` | Mitglied (≥`min_role`) | Nachrichten lesen, Keyset `?since_id=`/`?before_id=` (Polling) |
| `POST` | `/channels/{channelId}/messages` | Mitglied (≥`min_role`) | Nachricht senden |
| `DELETE` | `/channels/{channelId}/messages/{messageId}` | Autor ∨ moderator+ | Nachricht soft-löschen |

> Reaktionen, Edit, Ungelesen-Zähler etc. der Channel-Nachrichten laufen über die generischen Chat-
> Endpunkte (Chat-Kapitel) — gleiche `messages`/`message_reactions`-Tabellen, da **eine** Engine (ADR-005).

### 7.4 Mitglieder
| Methode | Pfad | Auth | Zweck |
|---|---|---|---|
| `GET` | `/groups/{id}/members` | gem. `visibility` | Mitgliederliste + Rollen |
| `POST` | `/groups/{id}/members` | erforderlich | Direktbeitritt (nur `join_policy=open`) |
| `DELETE` | `/groups/{id}/members/{userId}` | self (leave) ∨ moderator+ (kick) | austreten/entfernen |
| `PATCH` | `/groups/{id}/members/{userId}` | admin/owner (Rolle), moderator+ (ban) | Rolle ändern / bannen-entbannen / Eigentum übertragen (nur owner) |

### 7.5 Beitrittsanträge
| Methode | Pfad | Auth | Zweck |
|---|---|---|---|
| `POST` | `/groups/{id}/join-requests` | erforderlich | Antrag stellen (`join_policy=request`) |
| `GET` | `/groups/{id}/join-requests` | admin/owner | offene Anträge listen |
| `PATCH` | `/groups/{id}/join-requests/{requestId}` | admin/owner (decide), self (cancel) | approve/reject/cancel |

### 7.6 Einladungen
| Methode | Pfad | Auth | Zweck |
|---|---|---|---|
| `POST` | `/groups/{id}/invites` | admin/owner | Einladung erstellen (gerichtet ODER Token mit `expires_at`/`max_uses`) |
| `GET` | `/groups/{id}/invites` | admin/owner | aktive Einladungen listen |
| `DELETE` | `/groups/{id}/invites/{inviteId}` | admin/owner | widerrufen (`revoked`) |
| `GET` | `/invites/{token}` | optional | Link-Vorschau (Gruppen-Info) |
| `POST` | `/invites/{token}/accept` | erforderlich | Token einlösen → Mitgliedschaft |

### 7.7 Beispiel-Requests/Responses

**Gruppe gründen**
```http
POST /api/v1/groups
Content-Type: application/json
X-CSRF-TOKEN: <token>

{ "name": "Flieger Trier", "region": "Trier",
  "visibility": "public", "join_policy": "request",
  "description": "Gleitschirm-Community rund um die Mosel.",
  "tags": ["mosel", "anfaengerfreundlich"] }
```
```http
201 Created
{ "id": 42, "slug": "flieger-trier", "name": "Flieger Trier",
  "visibility": "public", "join_policy": "request",
  "owner_user_id": 7, "members_count": 1,
  "default_channel": { "id": 301, "title": "Allgemein", "is_default": true } }
```

**Beitritt zu offener Gruppe (Race → 409)**
```http
POST /api/v1/groups/42/members
→ 201 { "group_id": 42, "user_id": 7, "role": "member", "status": "active" }
→ 409 { "error": { "code": "already_member", "message": "Du bist bereits Mitglied dieser Gruppe." } }
→ 403 { "error": { "code": "group_member_banned", "message": "Du wurdest aus dieser Gruppe ausgeschlossen." } }
→ 409 { "error": { "code": "join_policy_mismatch", "message": "Diese Gruppe erfordert eine Anfrage oder Einladung." } }
```

**Token-Link einlösen**
```http
POST /api/v1/invites/3f9a...c1/accept
→ 201 { "group_id": 42, "joined": true }
→ 410 { "error": { "code": "invite_expired", "message": "Dieser Einladungslink ist abgelaufen." } }
→ 409 { "error": { "code": "invite_exhausted", "message": "Dieser Einladungslink wurde bereits vollständig genutzt." } }
```

**Beitrittsantrag genehmigen**
```http
PATCH /api/v1/groups/42/join-requests/88
{ "status": "approved" }
→ 200 { "id": 88, "status": "approved", "decided_by": 7, "member_created": true }
```

### 7.8 Fehler-Codes (`error.code`, Auszug)
| Code | HTTP | Bedeutung |
|---|---|---|
| `group_not_found` | 404 | Gruppe existiert nicht / nicht sichtbar |
| `forbidden_role` | 403 | Rolle reicht für Aktion nicht |
| `channel_role_required` | 403 | `min_role` des Channels nicht erfüllt |
| `already_member` | 409 | bereits Mitglied |
| `group_member_banned` | 403 | gebannt → Beitritt verweigert |
| `join_policy_mismatch` | 409 | Beitrittsweg passt nicht zur `join_policy` |
| `default_channel_not_deletable` | 409 | Default-Channel nicht löschbar |
| `last_channel_not_deletable` | 409 | letzter Channel nicht löschbar |
| `owner_must_transfer` | 409 | Owner muss vor Austritt Eigentum übertragen |
| `invite_expired` | 410 | Token abgelaufen |
| `invite_exhausted` | 409 | Token `max_uses` erreicht |
| `slug_taken` | 409 | Slug bereits vergeben |

---

## 8. Akzeptanzkriterien

**Sichtbarkeit & Beitritt**
1. Eine `public`-Gruppe erscheint im Verzeichnis und in der Suche; eine `unlisted`/`private` erscheint dort nie.
2. Der Feed einer `public`/`unlisted`-Gruppe ist **ohne Login** lesbar; der Feed einer `private`-Gruppe gibt für Nicht-Mitglieder `403`/reduzierte Karte zurück.
3. Channels sind in **jeder** `visibility` nur für Mitglieder lesbar (auch bei `public`).
4. `open` → `POST /members` macht sofort Mitglied; `request` → erzwingt Antrag; `invite_only` → kein Selbst-Beitritt möglich (nur Einladung/Token).
5. Alle 9 `visibility`×`join_policy`-Kombinationen sind anlegbar und verhalten sich gemäß §1.3.

**Rollen & Autorisierung**
6. Jede Gruppe hat **genau einen** `owner`; der letzte Owner kann nicht austreten/löschen ohne Eigentums-Transfer (`409 owner_must_transfer`).
7. `member` kann keinen Channel anlegen, nicht in den Feed posten und keine fremde Nachricht löschen (`403 forbidden_role`).
8. `moderator` kann fremde Nachrichten/Posts soft-löschen und kicken/bannen, aber **keine** Metadaten/Channels ändern und keine Rollen vergeben.
9. `admin` befördert höchstens bis `moderator`; nur `owner` vergibt `admin` und überträgt Eigentum.
10. Ein direkter API-Aufruf einer verbotenen Aktion (BOLA) wird **serverseitig** abgelehnt, auch wenn das Frontend den Button nicht zeigt.

**Channels & Feed**
11. Beim Gründen wird automatisch der Default-Channel „Allgemein" (`is_default=1`) erzeugt.
12. Default-Channel und letzter Channel sind nicht löschbar (`409`).
13. Ein `min_role='admin'`-Channel ist für `member`/`moderator` weder gelistet noch lesbar/beschreibbar.
14. Feed-Posts können nur `owner`/`admin` erstellen; der Feed paginiert per Keyset; gelöschte Posts erscheinen nicht mehr im Read.

**Beitritt (Anträge/Einladungen)**
15. Ein Nutzer kann pro Gruppe nur **einen offenen** (`pending`) Antrag haben.
16. Genehmigung eines Antrags erzeugt **in einer Transaktion** den `group_members`-Eintrag, erhöht `members_count` und benachrichtigt den Antragsteller (`group_request_approved`).
17. Ein abgelaufener (`expires_at < NOW()`) oder erschöpfter (`uses_count >= max_uses`) Token-Link wird abgelehnt (`410`/`409`); `expired` wird im Read abgeleitet, nicht per Cron persistiert.
18. `POST /invites/{token}/accept` ist idempotent gegen Doppelklick (zweiter Aufruf → `409 already_member`, kein Duplikat).
19. Ein `banned`-Nutzer kann über **keinen** Weg (open/request/invite/token) beitreten.

**Moderation & Integrität**
20. Mitglied-entfernen und Post-/Nachricht-löschen sind **Soft-Delete** (keine physische Löschung); Soft-gelöschte Inhalte verschwinden aus dem Read.
21. `UNIQUE(group_id, user_id)` verhindert doppelte Mitgliedschaften unter Nebenläufigkeit; `members_count` bleibt konsistent.
22. Moderation richtet sich nie gegen eine ranghöhere Rolle (z.B. `moderator` kann `admin` nicht kicken → `403`).

**Discovery & Metadaten**
23. `GET /groups/suggestions` liefert Region-passende, populäre Gruppen **ohne** bereits beigetretene.
24. `slug` ist eindeutig; doppelter Name in anderer Region ist erlaubt (`name` nicht UNIQUE).
25. Logo-Upload validiert MIME/Größe serverseitig, strippt EXIF und speichert randomisiert in `public/media/uploads/groups/`.

**Konventionen**
26. Alle nutzersichtbaren Labels Deutsch; alle `error.code`/DB-Keys/API-Felder Englisch; Datum/Zeit de-DE via Intl.
27. Realtime ausschließlich per Polling (aktiver Channel ~2–3 s, Listen/Feed ~15–30 s; Pause bei `document.hidden`).
