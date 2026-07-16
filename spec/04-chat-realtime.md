# Chat & Realtime

> Verbindliche Grundlagen: **ADR-001** (Polling-Realtime, MySQL = alleinige Source of Truth), **ADR-005** (eine polymorphe Chat-Engine), **ADR-009** (Chat-MVP „Mittel": Reaktionen + Soft-Edit/Delete), **ADR-004** (Shield-Session + BOLA), **ADR-008** (In-App-Benachrichtigungen). Tabellen-/Feldnamen folgen `DATA_MODEL.md` (`conversation_participants`, `last_read_message_id`). Dieses Kapitel verfeinert ausschließlich; es setzt keine ADR außer Kraft.
>
> **Wichtige Korrekturen gegenüber dem ursprünglichen Chat-Dossier** (durch ADRs überholt): kein externer Realtime-Dienst (Pusher/Ably/Supabase) und kein `/api/realtime/auth`-Endpoint → reines Polling (ADR-001); Tabelle heißt `conversation_participants`, **nicht** `conversation_members`; `message_reads` entfällt zugunsten `last_read_message_id` (ADR-005); Emoji-Reaktionen und Soft-Edit/Delete sind **MVP**, nicht Phase 2 (ADR-009). Anhänge, @-Mentions, Typing/Presence, `user_blocks` bleiben deferred.

---

## 1. Überblick

Die gesamte Chat-Funktionalität von FlightMeet läuft über **eine** generische Engine aus drei Tabellen:

- `conversations` — der Container (Gruppen-Channel, Flugtreffen-Chat oder Direktnachricht)
- `conversation_participants` — wer Mitglied ist + dessen Lesefortschritt (`last_read_message_id`)
- `messages` — die Nachrichten selbst (Soft-Edit/Delete, optionale Reply-Referenz)

ergänzt um `message_reactions` (Emoji-Reaktionen).

Drei Eigenschaften prägen das Kapitel:

1. **Polymorphie statt drei Chat-Implementierungen.** `type ∈ {group_channel, meetup, direct}` plus `context_type`/`context_id` verknüpfen eine Konversation lose mit einer Domänen-Entität. `messages` referenzieren **nie** ein Meetup oder eine Gruppe direkt, nur `conversation_id`.
2. **MySQL ist die einzige Wahrheit, Realtime ist Polling.** Es gibt keinen Push-Kanal und keinen parallelen Message-Store. „Echtzeit" entsteht durch gestaffeltes TanStack-Query-Polling mit `?since=` + `ETag`/`304` und `queryClient.setQueryData`-Merge.
3. **Autorisierung pro Konversation (BOLA).** Jeder Lese-/Schreibzugriff prüft serverseitig die Mitgliedschaft in `conversation_participants` — der React-Router schützt nur die UX.

---

## 2. Datenmodell (Referenz)

Maßgeblich ist `DATA_MODEL.md`. Hier nur die für dieses Kapitel relevanten Felder und ihre Bedeutung im Chat-Kontext.

### 2.1 `conversations`

| Feld | Typ | Bedeutung |
|---|---|---|
| `id` | PK BIGINT UNSIGNED | |
| `type` | ENUM `group_channel`,`meetup`,`direct` | Diskriminator der Engine. |
| `context_type` | ENUM `meetup`,`group`, NULL | Domänen-Entität, an die die Konversation gebunden ist. `NULL` bei `direct`. |
| `context_id` | BIGINT UNSIGNED, NULL | FK-**Wert** der Domänen-Entität — **kein harter FK** (polymorph, App-Level-Integrität, siehe §3). `NULL` bei `direct`. |
| `dm_key` | VARCHAR(40), NULL, **UNIQUE** | Deterministischer Schlüssel für `type=direct` (siehe §5). `NULL` bei allen anderen Typen. |
| `title` | VARCHAR, NULL | Channel-Name bei `group_channel`; bei `meetup`/`direct` zur Laufzeit abgeleitet (nicht persistiert nötig). |
| `created_by` | FK `users.id` | Ersteller der Konversation (nicht zu verwechseln mit `context.creator_id`, siehe §9). |
| `created_at`, `updated_at` | DATETIME | `updated_at` = Zeitpunkt der letzten Nachricht (für Sortierung der Konversationsliste). |

> **✅ Entschieden (ADR-012/A3):** Genau **eine** `meetup`-Konversation pro Meetup — erzwungen über die generierte Spalte `conversations.meetup_uniq` (= `context_id` nur wenn `type='meetup'`, sonst NULL) mit **UNIQUE**-Index (DATA_MODEL §7.1). Für `group_channel` bleibt Mehrfachvorkommen pro Gruppe erlaubt (NULL kollidiert nicht).

### 2.2 `conversation_participants`

| Feld | Typ | Bedeutung |
|---|---|---|
| `id` | PK | |
| `conversation_id` | FK `conversations.id` | |
| `user_id` | FK `users.id` | |
| `role` | ENUM `owner`,`admin`,`member` | Schreib-/Moderationsrechte innerhalb der Konversation. |
| `last_read_message_id` | BIGINT UNSIGNED, NULL, FK `messages.id` | Basis des Ungelesen-Zählers (§7). `NULL` = nie gelesen. |
| `last_read_at` | DATETIME, NULL | Komfort/Anzeige; autoritativ ist `last_read_message_id`. |
| `muted` | BOOL default false | Unterdrückt Benachrichtigungen für diese Konversation (§10). |
| `joined_at` | DATETIME | |
| — | **UNIQUE(`conversation_id`,`user_id`)** | Verhindert Doppelmitgliedschaft. |

> **Mitgliedschaftsmodell je Typ.** Für `direct` werden bei find-or-create **beide** Teilnehmer als Zeilen materialisiert. Für `group_channel`/`meetup` ist `conversation_participants` die **maßgebliche** Autorisierungstabelle; sie wird beim Beitritt zur Gruppe/zum Treffen befüllt bzw. (Fallback) im Read-Pfad gegen `group_members`/`meetup_participants` abgeglichen — siehe §8.

### 2.3 `messages`

| Feld | Typ | Bedeutung |
|---|---|---|
| `id` | PK BIGINT UNSIGNED | **Monoton steigend** — zugleich Cursor (§6) und `since`-Marke (§11). |
| `conversation_id` | FK `conversations.id` | |
| `sender_id` | FK `users.id` | |
| `body` | TEXT | **Plaintext** + Auto-Linkify im Client (ADR-011). Kein Markdown, kein HTML. |
| `reply_to_id` | BIGINT UNSIGNED, NULL, FK `messages.id` | Optionale Antwortreferenz (Render-Zitat). Self-FK. |
| `edited_at` | DATETIME, NULL | Soft-Edit (§8). |
| `deleted_at` | DATETIME, NULL | Soft-Delete → Tombstone (§8). |
| `created_at` | DATETIME | |
| — | **INDEX(`conversation_id`,`id`)** | Keyset-Pagination + `since`-Scan. |

### 2.4 `message_reactions` (MVP, ADR-009)

| Feld | Typ | Bedeutung |
|---|---|---|
| `id` | PK | |
| `message_id` | FK `messages.id` | |
| `user_id` | FK `users.id` | |
| `emoji` | VARCHAR(16) | Unicode-Emoji (z. B. `👍`, `🪂`). Server validiert gegen Allowlist. |
| `created_at` | DATETIME | |
| — | **UNIQUE(`message_id`,`user_id`,`emoji`)** | Idempotenz: ein Nutzer ein Emoji pro Nachricht genau einmal. |

### 2.5 Deferred (Schema vorbereiten, **nicht** im MVP)

| Tabelle/Feld | Status | ADR |
|---|---|---|
| `message_attachments` | Anhänge/Bilder — deferred | ADR-009 |
| `user_blocks` | DM-Blockieren — deferred | openMidLow (niedrig) |
| @-Mentions (Parsing + `notifications`) | deferred | ADR-009 |
| Typing-Indikator / Online-Presence | **gestrichen** (mit Polling unverhältnismäßig) | ADR-001, ADR-009 |
| `type='group_feed'` | als Enum-Wert offenhalten, nicht implementieren | openMidLow (mittel) |

---

## 3. Polymorphe Engine: Integritätsmodell

`context_id` ist ein **polymorpher Verweis ohne harten Fremdschlüssel** (er zeigt mal auf `meetups.id`, mal auf `groups.id`). Daraus folgt verbindlich (ADR-005):

- **App-Level-Integrität:** Beim Erstellen einer `meetup`/`group_channel`-Konversation prüft der Service die Existenz der Domänen-Entität explizit; es gibt keinen DB-FK, der das erzwingt.
- **Bewusstes Aufräumen (kein Cron, ADR-002):** Wird ein Meetup oder eine Gruppe gelöscht, räumt derselbe Service-Aufruf in einer **Transaktion** die zugehörige(n) `conversations` + `conversation_participants` + `messages` (Soft- oder Hard-Delete je nach Domänen-Policy) auf. Es gibt keinen Scheduler, der verwaiste Konversationen nachträglich einsammelt.
- **Tests statt Constraint:** Die polymorphe Bindung wird durch Integrationstests abgesichert (Konversation eines gelöschten Meetups ist nicht mehr erreichbar; keine Nachricht ohne gültige Konversation).

> **✅ Entschieden (ADR-012/C5):** Beim Löschen einer Domänen-Entität (Gruppe/Meetup) werden zugehörige Konversationen **soft-gelöscht** (`deleted_at`), die History bleibt eingefroren read-only — **kein** Hard-Delete.

---

## 4. Konversation erstellen / auflösen

| Typ | Entstehung |
|---|---|
| `group_channel` | Beim Anlegen eines Channels in einer Gruppe (Gruppen-Domäne). `context_type='group'`, `context_id=group.id`, `title` = Channel-Name. Teilnehmer = Gruppenmitglieder. |
| `meetup` | Beim Anlegen des Meetups, in derselben Transaktion (`MeetupService::create`): genau eine Konversation pro Meetup (`context_type='meetup'`, `context_id=meetup.id`, `uq_conv_meetup`). Teilnehmer = `meetup_participants`. Beim Hard-Delete des Treffens wird sie mit-gelöscht (ADR-014). |
| `direct` | **find-or-create** über `dm_key` (§5). |

---

## 5. Direktnachrichten: deterministischer `dm_key` + find-or-create

Damit zwischen zwei Nutzern niemals zwei DM-Konversationen entstehen (Race-Schutz, Querschnitt „Datenintegrität"):

1. **Schlüsselbildung:** `dm_key = min(userA, userB) + ':' + max(userA, userB)` (z. B. `"42:1337"`). Deterministisch, reihenfolgeunabhängig.
2. **DB-Garantie:** `UNIQUE`-Index auf `conversations.dm_key`.
3. **Transaktionales find-or-create** (`POST /conversations` mit `type=direct`, `recipient_id`):
   - `SELECT` auf `dm_key`; gefunden → zurückgeben.
   - sonst in einer Transaktion: `INSERT conversations (type='direct', dm_key=…, created_by=me)` + zwei `conversation_participants`-Zeilen. Bei `UNIQUE`-Verletzung durch nebenläufigen Insert → `SELECT` erneut und vorhandene Zeile zurückgeben (idempotenter Ausgang).
4. Selbst-DM (`recipient_id == me`) → `422 validation`.

**Antwort** ist in beiden Fällen `200`/`201` mit derselben Konversation — der Client behandelt „neu" und „existierte schon" identisch.

---

## 6. History: Keyset-Pagination

Nachrichten werden **abwärts** (neueste zuerst) seitenweise geladen, robust gegen währenddessen eintreffende neue Nachrichten.

- **Cursor = `messages.id`** (monoton steigend). Keine `OFFSET`-Pagination.
- Request: `GET /conversations/{id}/messages?before=<message_id>&limit=30` (Default `limit=30`, Max `100`).
- SQL-Kern: `WHERE conversation_id = ? AND id < :before ORDER BY id DESC LIMIT :limit` (genutzt vom Index `(conversation_id, id)`). Ohne `before` → die jüngste Seite.
- **Antwort enthält** `next_before` (= `id` der ältesten gelieferten Nachricht) und `has_more`. Frontend rendert in aufsteigender Reihenfolge (Array reversen) und blättert beim Hochscrollen mit `before=next_before` weiter.
- **Soft-deleted** Nachrichten werden **mitgeliefert** (als Tombstone, §8), damit Reply-Referenzen und Reihenfolge stabil bleiben.

> Trennung der Achsen: `before=` lädt **ältere** History (hochscrollen); `since=` (§11) lädt **neuere** Nachrichten (Live-Polling). Beide nutzen denselben Index.

---

## 7. Ungelesen-Zähler über `last_read_message_id`

Kein Eintrag pro Nachricht pro Nutzer. Pro `(user, conversation)` genau ein Wasserstand.

- **Pro Konversation:** `unread = COUNT(messages WHERE conversation_id = c AND id > last_read_message_id AND sender_id <> me AND deleted_at IS NULL)`. Bei `last_read_message_id IS NULL` zählen alle (fremden) Nachrichten.
- **Global** (für die Topbar-Badge, ADR-008): Summe der Konversations-Unreads des Nutzers, geliefert von einem **schlanken** Endpoint `GET /me/unread` (zusammen mit dem Notification-Unread-Aggregat). Genau dieser Endpoint wird im langsamen Takt gepollt (§11) und unterstützt `ETag`/`304`.
- **Lesefortschritt setzen:** `POST /conversations/{id}/read` mit `{ last_read_message_id }`. Server setzt den Wert **monoton** (nie zurück: `GREATEST(current, incoming)`), aktualisiert `last_read_at`. Der Client ruft das beim Öffnen/Sichtbarwerden der Konversation und beim Erreichen des unteren Endes auf.

---

## 8. Soft-Edit / Soft-Delete (MVP, ADR-009)

- **Bearbeiten** (`PATCH /messages/{id}`): nur `sender_id == me`, nur wenn `deleted_at IS NULL`. Setzt `body` neu + `edited_at = now()`. Client zeigt „(bearbeitet)".
  > **✅ Entschieden (ADR-012/C6):** Bearbeiten nur innerhalb **15 Minuten** ab `created_at` (app-seitig geprüft); danach gesperrt. Soft-Delete bleibt jederzeit möglich.
- **Löschen** (`DELETE /messages/{id}`): erlaubt für `sender_id == me` **oder** Konversations-`owner`/`admin` (aus `conversation_participants.role`). Setzt `deleted_at = now()` (+ optional `deleted_by`, ADR-008). **Hard-Delete nie** im MVP.
- **Tombstone-Darstellung:** Eine soft-deleted Nachricht wird mit leerem/ausgegrautem Body als **„Nachricht gelöscht"** gerendert. `body` wird in der API-Antwort **nicht** ausgeliefert (`body: null`), `reactions` werden mit gelöscht/ausgeblendet. Die Zeile bleibt für Reihenfolge/Reply-Anker erhalten.
- **Emoji-Reaktionen** (`POST /messages/{id}/reactions`, toggle): fügt hinzu oder entfernt (idempotent über `UNIQUE(message_id,user_id,emoji)`). Server-Allowlist begrenzt die Emoji-Menge. Reaktionen auf gelöschte Nachrichten sind nicht erlaubt (`409`).
- **Antworten / Reply** (MVP, ADR-014): Senden mit `reply_to_id`. Der Client zeigt über der Antwort eine kleine **Zitat-Vorschau** (Autor + gekürzter Text) der referenzierten Nachricht. **Nur eine Bezugsebene** (keine verschachtelten Threads). Ist die Bezugsnachricht soft-gelöscht, zeigt die Vorschau „Nachricht nicht mehr verfügbar".

---

## 9. Ersteller-Hervorhebung = reine Render-Regel

Kein DB-Feld (ADR-005). Im **Meetup-Chat** wird die Nachricht des Treffen-Erstellers visuell hervorgehoben:

- Server löst zur Antwortzeit `conversation.context_type='meetup' → meetups.creator_id` (bzw. `groups.owner` bei `group_channel`) auf und liefert pro Nachricht ein **abgeleitetes** Flag `is_creator: sender_id == context.creator_id`.
- Bei `type='direct'` ist `is_creator` immer `false`/`null`.
- Das Flag wird **nicht** persistiert und ändert sich automatisch mit, falls die Domänen-Eigentümerschaft wechselt.

---

## 10. Anbindung an In-App-Benachrichtigungen (ADR-008)

- Beim Senden einer Nachricht erzeugt der Service `notifications`-Einträge für alle **anderen** Teilnehmer der Konversation, **außer** der jeweilige Teilnehmer hat `muted=true`. Typ z. B. `notification.type='chat_message'` mit Bezug auf `conversation_id`/`message_id`.
- **Kein Push, kein Cron:** Die Benachrichtigung wird genau wie der Unread-Zähler über den langsamen Poll von `GET /me/unread` bzw. das Notification-Center sichtbar (gleicher Read-Pfad, ADR-001/ADR-008).
- @-Mentions als gesonderter Notification-Typ sind **deferred** (ADR-009).

> **✅ Entschieden (ADR-012/C7):** Pro Konversation wird **eine** ungelesene `message_received`-Notification geführt (nicht je Nachricht) und beim Lesen der Konversation aufgelöst — so flutet das Center nicht.

---

## 11. Polling-Strategie (konkret, ADR-001)

Realtime ist ausschließlich TanStack-Query-Polling gegen die REST-API. **Kein** WebSocket, **kein** externer Dienst, **kein** `realtime/auth`-Endpoint.

### 11.1 Gestaffelte Intervalle

| Query | `refetchInterval` | Bemerkung |
|---|---|---|
| Aktive/offene Konversation (`messages?since=`) | **2–3 s** | Nur die gerade geöffnete Konversation. |
| Konversationsliste (`GET /conversations`) | **15–30 s** | Letzte Nachricht + Unread je Konversation. |
| Globales Unread-/Notification-Aggregat (`GET /me/unread`) | **15–30 s** | Topbar-Badge. |

### 11.2 Inkrementell statt voll: `?since=` + `ETag`/`304`

- **Live-Tail:** `GET /conversations/{id}/messages?since=<last_seen_message_id>` liefert Nachrichten mit `id > since`. Zusätzlich werden Edits/Soft-Deletes/Reaktionen über `updated_at > since_ts` mitgeliefert (kombiniertes Delta, ADR-012/A2; siehe §11.2 unten).
- **`ETag`/`If-None-Match`:** Antworten tragen ein `ETag` (z. B. abgeleitet aus `MAX(messages.id)` + Reaktions-/Edit-Stand der Konversation). Schickt der Client `If-None-Match`, antwortet der Server bei unverändertem Stand mit **`304 Not Modified`** ohne Body. Das hält die häufigen 2–3-s-Polls billig.
- `GET /me/unread` ist ebenfalls `ETag`-fähig (Aggregat-Hash), damit der Standardfall „nichts Neues" ein leeres `304` ist.

> **✅ Entschieden (ADR-012/A2):** `messages.updated_at` (TIMESTAMP(3)) wird gepflegt; es bumpt bei Edit/Soft-Delete und wird bei Reaktions-Änderungen der Nachricht „getoucht". Der Live-Tail liefert `id > :since_id OR updated_at > :since_ts` — so kommen auch Edits/Deletes/Reaktionen live an (DATA_MODEL §7.3).

### 11.3 Cache-Merge ohne parallelen Store

Eingehende Nachrichten werden via **`queryClient.setQueryData`** in den bestehenden History-Cache der Konversation gemerged (Querschnitt: kein paralleler Message-Store in Zustand).

- Dedupe über `messages.id`; neue ans Ende, Edits/Deletes patchen die vorhandene Zeile (Tombstone), Reaktionen ersetzen das `reactions`-Array der Zielnachricht.
- Optimistisches Senden: lokale Nachricht mit Temp-ID einfügen, nach `201` durch die echte ersetzen (Reconciliation über `client_nonce` → `id`).

### 11.4 Pause bei Inaktivität

- Polling **pausiert bei `document.hidden`** und ohne Fenster-Fokus: TanStack `refetchIntervalInBackground: false` + ein `visibilitychange`-Listener, der bei Rückkehr **sofort** einen `since=`-Refetch auslöst (Lücke schließen).
- Beim Verlassen einer Konversation fällt deren 2–3-s-Poll weg (Query unmountet); nur Liste/Aggregat pollen weiter im langsamen Takt.

---

## 12. Autorisierung pro Konversation (BOLA, ADR-004)

React-Routing-Gates sind nur UX. Jeder Endpoint durchläuft den zentralen Shield-`auth`-Before-Filter (Authentifizierung) **plus** pro-Objekt-Autorisierung im `BaseApiController`-Helper:

| Aktion | Prüfung |
|---|---|
| Konversation lesen / Nachrichten lesen | Mitglied in `conversation_participants(conversation_id, me)`. Bei `group_channel`/`meetup` als Fallback Abgleich gegen `group_members`/`meetup_participants` (§2.2). |
| Nachricht senden | Mitglied **und** `role ∈ {owner,admin,member}` (kein read-only); Konversation nicht soft-deleted. |
| Nachricht bearbeiten | `sender_id == me`. |
| Nachricht löschen | `sender_id == me` **oder** `role ∈ {owner,admin}` in dieser Konversation. |
| DM starten | Empfänger existiert, nicht self; (deferred: nicht geblockt). |

Fehlende Berechtigung → **`404 not_found`** (Existenz nicht preisgeben) bzw. `403 forbidden` bei bekanntem Objekt ohne Recht. Antworten tragen stabilen `error.code` (englisch) + deutsche `error.message` (Querschnitt-Konvention).

---

## 13. API-Endpunkte

> ⚠️ **Verbindlicher Vertrag = [`API.md §9–11`](API.md) + committetes Frontend** (`frontend/src/api/chat.ts`, `api/schemas/chat.ts`, `api/notifications.ts`). Dieses Dossier hält das Design-/Integritätsdenken fest; die **ausgelieferte** API ist bewusst einfacher (M5, Option B). Abweichungen dieses Abschnitts (für die Umsetzung gilt API.md):
> - DM: **`POST /conversations/direct { user_id }` → `{ id }`** (nicht `POST /conversations { type, recipient_id }`; kein `dm_key`/`participants` in der Antwort).
> - Nachrichten-Mutationen **verschachtelt** unter `/conversations/{id}/messages/{messageId}` (kein top-level `/messages/{id}`). **DELETE → 200 Tombstone-`Message`** (nicht 204).
> - Reaktionen: **`POST …/messages/{messageId}/reactions { emoji }` (Toggle) → ganze `Message`** (nicht `PUT/DELETE …/reactions/{emoji}`).
> - `GET …/messages` liefert die **volle `Message[]`-Liste** (kein `before=`/`since=`/`meta`); Keyset (§6) + `?since=`-Delta (§11.2) sind **deferred** (kein Frontend-Konsument). Realtime = **Polling + ETag/304** (kein Cache-Merge, voller Refetch).
> - `POST /conversations/{id}/read` **ohne** Body (mark-all-read) → 204.
> - `sender` = `PublicUserCard` (`id`); `reply_to` = eingebettete Vorschau `{ id, sender_name, body }`; kein `client_nonce` (optimistisches UI rein clientseitig).
> - Unread-Zähler: getrennte Endpunkte `GET /conversations/unread-count` + `GET /notifications/unread-count` (je bare `number`); **kein** `GET /me/unread`. Keine `GET /users/search` (DM-Start via Profilseite).
> - Notification-Typ **`new_message`** (statt `message_received`); Notif-Read-Endpunkte liefern die **ganze `Notification[]`**.
>
> Basis-Präfix `/api/v1`. Cookies via `credentials: 'include'` + CSRF-Header (ADR-004). Felder/`error.code` englisch, Labels deutsch. **Entfällt** gegenüber dem alten Dossier: `POST /api/realtime/auth` (kein externer Realtime-Dienst).

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/conversations` | Konversationen des Nutzers: letzte Nachricht, `unread_count`, `type`, Titel. Poll ~15–30 s, `ETag`. |
| `POST` | `/conversations` | `type=direct` → find-or-create via `dm_key` (§5); andere Typen i. d. R. domänenseitig erstellt. |
| `GET` | `/conversations/{id}` | Metadaten + Teilnehmer (nach Mitgliedschaftsprüfung). |
| `GET` | `/conversations/{id}/messages` | History `before=&limit=` (§6) **oder** Live-Tail `since=` (§11); `ETag`/`304`. |
| `POST` | `/conversations/{id}/messages` | Nachricht senden → MySQL (Source of Truth). `client_nonce` für optimistisches UI. |
| `POST` | `/conversations/{id}/read` | `last_read_message_id` setzen (monoton, §7). |
| `PATCH` | `/messages/{id}` | Soft-Edit (`edited_at`), nur Sender. |
| `DELETE` | `/messages/{id}` | Soft-Delete (`deleted_at`), Sender oder owner/admin. |
| `POST` | `/messages/{id}/reactions` | Emoji-Reaktion toggeln (idempotent). |
| `GET` | `/me/unread` | Globales Aggregat (Chat + Notifications) für Topbar-Badge; `ETag`/`304`; Poll ~15–30 s. |
| `GET` | `/users/search?q=` | Nutzer suchen, um eine DM zu starten. |

### 13.1 Beispiel — Nachricht senden

Request:
```http
POST /api/v1/conversations/57/messages
Content-Type: application/json
X-CSRF-TOKEN: <token>

{ "body": "Wer ist morgen am Wallberg? 🪂", "client_nonce": "c1f9-..." , "reply_to_id": null }
```
Response `201`:
```json
{
  "data": {
    "id": 8123,
    "conversation_id": 57,
    "sender_id": 42,
    "body": "Wer ist morgen am Wallberg? 🪂",
    "reply_to_id": null,
    "is_creator": true,
    "edited_at": null,
    "deleted_at": null,
    "created_at": "2026-06-19T14:08:00+02:00",
    "reactions": [],
    "client_nonce": "c1f9-..."
  }
}
```

### 13.2 Beispiel — Live-Tail mit `since` + `304`

Request:
```http
GET /api/v1/conversations/57/messages?since=8123
If-None-Match: "conv57:8123:r0"
```
Response bei nichts Neuem: `304 Not Modified` (kein Body).
Response mit neuer Nachricht `200`, `ETag: "conv57:8124:r0"`:
```json
{ "data": [ { "id": 8124, "sender_id": 99, "body": "Bin dabei!", "is_creator": false, "edited_at": null, "deleted_at": null, "created_at": "2026-06-19T14:09:11+02:00", "reactions": [] } ], "meta": { "max_id": 8124 } }
```

### 13.3 Beispiel — DM find-or-create

```http
POST /api/v1/conversations
{ "type": "direct", "recipient_id": 1337 }
```
`200` (existierte) oder `201` (neu), identische Hülle:
```json
{ "data": { "id": 210, "type": "direct", "dm_key": "42:1337", "participants": [42, 1337] } }
```

### 13.4 Beispiel — Tombstone

```json
{ "id": 8050, "sender_id": 42, "body": null, "deleted_at": "2026-06-19T13:50:00+02:00", "reactions": [], "is_tombstone": true }
```

---

## 14. Akzeptanzkriterien

**Engine & Modell**
- [ ] Gruppen-Channel, Meetup-Chat und DM laufen über **dieselben** Tabellen (`conversations`/`conversation_participants`/`messages`); es existieren **keine** `group_messages`/`group_channels`-Tabellen (ADR-005).
- [ ] `messages` referenzieren ausschließlich `conversation_id`, nie ein Meetup/eine Gruppe direkt.
- [ ] Löschen eines Meetups/einer Gruppe räumt die zugehörigen Konversationen transaktional auf; keine verwaisten erreichbaren Konversationen (kein Cron nötig).

**DM**
- [ ] Zwei DM-Erstellversuche zwischen denselben Nutzern (auch nebenläufig) ergeben **genau eine** Konversation (`dm_key` UNIQUE, find-or-create idempotent).
- [ ] Selbst-DM wird mit `422` abgelehnt.

**History & Pagination**
- [ ] `before=&limit=` liefert deterministisch ältere Seiten ohne Duplikate/Lücken bei gleichzeitig eintreffenden Nachrichten (Keyset, kein OFFSET).
- [ ] Soft-deleted Nachrichten erscheinen als Tombstone an korrekter Position; Reply-Anker bleiben gültig.

**Ungelesen**
- [ ] `unread_count` pro Konversation = Anzahl fremder, nicht gelöschter Nachrichten mit `id > last_read_message_id`.
- [ ] `POST /read` setzt den Wasserstand **monoton** (nie rückwärts).
- [ ] Globaler Badge-Wert = Summe der Konversations-Unreads, geliefert von `GET /me/unread` (ein Request).

**Reaktionen / Edit / Delete (MVP)**
- [ ] Emoji-Reaktion ist idempotent (zweiter identischer Toggle entfernt sie); `UNIQUE(message_id,user_id,emoji)` greift.
- [ ] Edit setzt `edited_at` und zeigt „(bearbeitet)"; nur der Sender darf editieren.
- [ ] Delete setzt `deleted_at`, liefert `body: null`, erlaubt für Sender oder owner/admin; **kein** Hard-Delete.
- [ ] Reaktion auf gelöschte Nachricht → `409`.

**Ersteller-Hervorhebung**
- [ ] Im Meetup-Chat trägt jede Nachricht ein abgeleitetes `is_creator` (`sender_id == meetups.creator_id`); kein DB-Feld; bei DM stets `false`.

**Polling**
- [ ] Aktive Konversation pollt 2–3 s, Listen/Aggregat 15–30 s.
- [ ] `?since=` liefert nur neue/geänderte Nachrichten; unveränderter Stand ergibt `304`.
- [ ] Eingehende Nachrichten werden per `queryClient.setQueryData` gemerged; kein paralleler Zustand-Store; Dedupe über `id`.
- [ ] Polling pausiert bei `document.hidden`/fehlendem Fokus und schließt bei Rückkehr die Lücke per `since=`-Refetch.

**Autorisierung (BOLA)**
- [ ] Jeder Lese-/Schreibendpoint prüft Mitgliedschaft in `conversation_participants` serverseitig; Nicht-Mitglied erhält `404`/`403`, niemals Inhalte.
- [ ] Senden in einer soft-deleted Konversation ist nicht möglich.

**Benachrichtigungen**
- [ ] Neue Nachricht erzeugt In-App-`notifications` für andere, nicht-`muted` Teilnehmer; sichtbar über denselben Polling-Read-Pfad (kein Push, kein Cron).

**Deferred korrekt markiert**
- [ ] Anhänge, @-Mentions, Typing/Presence, `user_blocks`, `group_feed` sind nicht implementiert; Schema bleibt erweiterbar (Enum offen, `message_attachments` vorbereitbar).

---

Relevante Dateien: `/Users/fabian/programming/fwe/spec/DECISIONS.md`, `/Users/fabian/programming/fwe/spec/DATA_MODEL.md`.
