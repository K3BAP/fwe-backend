# Seed-Daten & Demo-Plan FlightMeet

Diese Datei definiert den **verbindlichen Plan für Demo-/Seed-Daten** (CI4-Faker-Seeder), mit denen FlightMeet bei der Abnahme „voll" und glaubwürdig wirkt. Sie baut **direkt** auf [`DATA_MODEL.md`](DATA_MODEL.md) (Tabellen-/Feldnamen sind dort verbindlich) und [`DECISIONS.md`](DECISIONS.md) auf.

> ⚠️ **Umsetzungsstand (M6):** Der ausgelieferte Seeder (`app/Database/Seeds/DatabaseSeeder.php`) ist
> **hand-kuratiert und deterministisch — ohne Faker**: feste deutsche Texte lesen sich in der Demo
> glaubwürdiger als generierte, und der SQL-Dump bleibt stabil (ADR-002). Mengen gegenüber dem Plan
> moderat verkleinert: **1 Admin + 15 Piloten** (statt 30), **18 Treffen** (statt 25 — alle vier
> abgeleiteten Status abgedeckt), ~22 Benachrichtigungen (statt ~50); 30 Spots und 8 Gruppen wie
> geplant. `home_spot_id` existiert nicht (s. DATA_MODEL §3.1), eine Warteliste gibt es nicht
> (ADR-015). Die Pilot-Array-Indizes **0/1/2 = Lena/Markus/Sophie** werden von Gruppen-/Treffen-
> Mitgliedschaften referenziert — stabil halten, neue Nutzer hinten anhängen (CLAUDE.md §10).

**Grundsätze (aus den ADRs abgeleitet):**
- **Deterministisch & reproduzierbar:** Faker mit **festem Seed** (`$faker->seed(15)` — passend zu `db_team15`), damit Demo-Daten zwischen Läufen identisch sind und der lokale SQL-Dump (ADR-002) stabil bleibt.
- **Deutsch sichtbar, Englisch technisch:** Faker-Locale `de_DE`; alle nutzersichtbaren Texte (Bios, Treffen-Titel, Nachrichten, Feed-Posts) deutsch; alle Enum-Keys/Status englisch (Konvention).
- **Idempotenz / sauberer Start:** Seeder leeren ihre Zieltabellen vor dem Befüllen NICHT automatisch (Faker-Seeds sind additiv). Für Demo gilt: **frische DB** → Migrations → Seed. Ein optionaler `--clean`-Schalter im `DatabaseSeeder` (TRUNCATE in FK-sicherer Reihenfolge mit `FOREIGN_KEY_CHECKS=0`) ist empfohlen.
- **Realistische Zeitverteilung:** `starts_at`/`created_at` über Vergangenheit **und** Zukunft streuen, damit abgeleitete Status (`finished`, `open`, `full`, `cancelled`, §4.2.1 DATA_MODEL) alle in der UI sichtbar sind.
- **Kein Cron (ADR-002):** abgeleitete Zustände entstehen rein aus den Daten (z.B. vergangenes `starts_at` ⇒ `finished` im Read). Seeder müssen daher bewusst Treffen in der Vergangenheit anlegen.

---

## 1) `spots` — reale Gleitschirm-Startplätze im DACH-Raum (Seed-Liste)

Kuratierte Liste für die `spots`-Tabelle (ADR-007, §4.1 DATA_MODEL). **Spalten:** `name`, `region`, `country` (ISO-3166-alpha2), `lat`, `lng`, `type`.

> ⚠️ **Koordinaten ca. — vor dem Seed verifizieren.** Die lat/lng-Werte sind Näherungswerte für den jeweiligen Startbereich und dienen nur dazu, dass der Leaflet-Marker im richtigen Tal/Berg landet. Vor der finalen Abnahme jeden Wert gegen eine verlässliche Quelle (DHV-Geländedatenbank, paragliding365, OpenStreetMap) prüfen und ggf. korrigieren. Namen sind teils umgangssprachlich/lokal — bei Bedarf an die DHV-Geländenamen angleichen.

| # | name | region | country | lat (ca.) | lng (ca.) | type |
|---|---|---|---|---|---|---|
| 1 | Wasserkuppe | Rhön | DE | 50.498 | 9.948 | launch |
| 2 | Tegelberg | Allgäu | DE | 47.585 | 10.764 | launch |
| 3 | Brauneck | Bayerische Voralpen | DE | 47.667 | 11.555 | launch |
| 4 | Hochfelln | Chiemgau | DE | 47.768 | 12.610 | launch |
| 5 | Hochries | Chiemgau | DE | 47.733 | 12.230 | launch |
| 6 | Blomberg | Bayerische Voralpen | DE | 47.683 | 11.450 | launch |
| 7 | Jochberg (Walchensee) | Bayerische Voralpen | DE | 47.600 | 11.330 | launch |
| 8 | Wallberg (Tegernsee) | Tegernsee | DE | 47.660 | 11.770 | launch |
| 9 | Hohe Bracht | Sauerland | DE | 51.130 | 7.970 | launch |
| 10 | Greifenburg / Emberger Alm | Kärnten (Drautal) | AT | 46.760 | 13.150 | launch |
| 11 | Sattnitz / Kraig | Kärnten | AT | 46.720 | 14.340 | launch |
| 12 | Stubaital (Elfer / Kreuzjoch) | Tirol (Stubai) | AT | 47.110 | 11.310 | launch |
| 13 | Kössen (Unterberghorn) | Tirol (Kaisergebirge) | AT | 47.680 | 12.400 | launch |
| 14 | Zell am See (Schmittenhöhe) | Salzburg (Pinzgau) | AT | 47.330 | 12.740 | launch |
| 15 | Gerlitzen | Kärnten | AT | 46.690 | 13.910 | launch |
| 16 | Stoderzinken | Steiermark (Ennstal) | AT | 47.530 | 13.890 | launch |
| 17 | Achensee (Maurach / Rofan) | Tirol | AT | 47.430 | 11.730 | launch |
| 18 | Niederöblarn / Wörschachwald | Steiermark (Ennstal) | AT | 47.500 | 14.030 | launch |
| 19 | Interlaken (Beatenberg / Niederhorn) | Berner Oberland | CH | 46.700 | 7.800 | launch |
| 20 | Fiesch / Eggishorn | Wallis | CH | 46.400 | 8.130 | launch |
| 21 | Verbier (La Chaux) | Wallis | CH | 46.090 | 7.250 | launch |
| 22 | Grindelwald (First) | Berner Oberland | CH | 46.660 | 8.060 | launch |
| 23 | Klewenalp (Vierwaldstättersee) | Zentralschweiz | CH | 46.950 | 8.490 | launch |
| 24 | Beuren (Schwäbische Alb) | Schwäbische Alb | DE | 48.560 | 9.390 | launch |
| 25 | Hohenneuffen | Schwäbische Alb | DE | 48.555 | 9.380 | launch |
| 26 | Kandel (Schwarzwald) | Schwarzwald | DE | 48.060 | 8.010 | launch |
| 27 | Hocheck / Oberaudorf | Inntal (Bayern) | DE | 47.640 | 12.180 | launch |
| 28 | Mosel — Calmont / Bremm | Mosel/Eifel | DE | 50.090 | 7.130 | area |
| 29 | Nürburg / Hohe Acht (Eifel) | Mosel/Eifel | DE | 50.380 | 7.000 | launch |
| 30 | Idarkopf (Hunsrück) | Hunsrück | DE | 49.800 | 7.250 | launch |

**Hinweise zur Liste:**
- **30 Spots** (über der ADR-Untergrenze ~20–30), bewusst breit über DACH gestreut: Bayern/Alpen-Schwerpunkt, dazu Rhön, Schwäbische Alb, Schwarzwald, Sauerland sowie **Mosel/Eifel/Hunsrück** (lokaler Trier-Bezug zur Uni — gute Demo-Wirkung).
- `region` ist die **denormalisierte** Quelle für `meetups.region` (§4.2 DATA_MODEL) und `idx_spots_region`.
- `type`: Standard `launch`; `area` für das großflächige Fluggebiet Calmont/Mosel. Bei Bedarf einzelne `landing`-Spots ergänzen (im MVP nicht nötig).
- Für `profiles.home_spot_id`: einige Piloten bekommen einen zufälligen Spot aus dieser Liste als Heimat-Startplatz zugewiesen.
- **`regions`-Tabelle bleibt OPTIONAL** (§4.4) — im Seed wird `region` als VARCHAR direkt aus der Liste übernommen; kein `RegionSeeder` nötig, solange Regionen nicht als Lookup-Dropdown gebraucht werden.

---

## 2) Seed-Mengen (für eine überzeugende Abnahme)

Zielbild: Jede Liste in der UI ist gefüllt, jeder abgeleitete Zustand ist sichtbar, Chat & Notifications wirken „lebendig". Mengen bewusst moderat (schneller Seed, kleiner Dump), aber dicht genug für eine glaubwürdige Demo.

### 2.1 Übersicht

| Entität | Tabelle(n) | Menge | Demo-Zweck |
|---|---|---|---|
| Admin-Account | `users` + `auth_groups_users` + `profiles` | **1** | Login als Admin, Moderation, Feed-Posts (§4) |
| Piloten | `users` + `auth_identities` + `auth_groups_users` (`user`) + `profiles` | **30** | gefülltes Mitgliederverzeichnis, Treffen-/Gruppen-Teilnehmer |
| Startplätze | `spots` | **30** (§1) | Karte + Autocomplete |
| Gruppen | `groups` | **8** | Verzeichnis mit allen visibility/join_policy-Kombinationen |
| Gruppen-Mitgliedschaften | `group_members` | **~60** (Ø 7–8 / Gruppe) | volle Mitgliederlisten, Rollen |
| Default-Channel | `conversations type=group_channel is_default=1` | **8** (1 je Gruppe) | „Allgemein"-Channel |
| Zusatz-Channels | `conversations type=group_channel` | **~10** (0–3 je Gruppe) | Channel-Liste, `min_role=admin` bei 1–2 |
| Beitrittsanträge | `group_join_requests` | **~6** (in `request`-Gruppen) | offene/entschiedene Anträge, Admin-Posteingang |
| Einladungen | `group_invites` | **~5** (in `invite_only`-Gruppen) | gerichtete + Token-Link-Einladung |
| Feed-Posts | `feed_posts` | **~20** (2–4 je Gruppe) | gefüllter Gruppen-Feed, 1 gepinnt je Gruppe |
| Flugtreffen | `meetups` | **25** | Karte + Liste, über Spots/Regionen/Zeit verteilt |
| Treffen-Teilnahmen | `meetup_participants` | **~120** (Ø 4–6 / Treffen) | Teilnehmerlisten, `full`-Zustand, Warteliste |
| Treffen-Chats | `conversations type=meetup` | **25** (1 je Treffen) | Ersteller-Hervorhebung (`is_creator`) |
| Direktnachrichten | `conversations type=direct` | **~10** | DM-Sidebar, `dm_key`-Logik |
| Konv.-Teilnahmen | `conversation_participants` | **~250** | Autorisierung + Unread-Zähler |
| Nachrichten | `messages` | **~400** | volle Chat-Historie (Keyset-Pagination demonstrierbar) |
| Reaktionen | `message_reactions` | **~80** | Emoji-Reaktionen (ADR-009) |
| Benachrichtigungen | `notifications` | **~50** (teils ungelesen) | Badge-Zähler + Notification-Center |

### 2.2 Detailvorgaben je Bereich

**Piloten (`profiles`, ADR-010):**
- 30 User, `username` aus `de_DE`-Faker; `display_name` realistisch (Vorname Nachname oder Pilot-Handle).
- **~70 %** mit ausgefülltem `bio_markdown` (eingeschränktes Markdown: Fett, Liste, Link — testet das Sanitizing/Rendering, ADR-011); Rest leer (nullable-Pfad testen).
- `experience_level` gemischt: ~30 % `beginner`, ~45 % `advanced`, ~25 % `expert`.
- `license_class` gemischt (`a_license`/`b_license`/`none`), `glider` Freitext (z.B. „Ozone Rush 6", „Nova Mentor 7"), `flight_hours` 5–1200, `home_spot_id` bei ~60 % gesetzt, `home_region` passend.
- `avatar_path`: 1–2 Platzhalter-Avatare unter `public/media/uploads/avatars/` (oder NULL ⇒ Initialen-Fallback im FE). **Keine** echten Personenfotos seeden.
- `email_verified_at` bleibt **NULL** (deferred, ADR-008).

**Gruppen (`groups`, ADR-006) — alle Kombinationen abdecken:**

| Gruppe (Beispiel) | visibility | join_policy | Zweck |
|---|---|---|---|
| „Gleitschirm Alpen Süd" | public | open | Standardfall, Direktbeitritt |
| „Mosel & Eifel Flieger" | public | request | Beitrittsantrag-Workflow |
| „Streckenflug-Profis DACH" | public | invite_only | Einladungs-Workflow |
| „Stubai Locals" | unlisted | open | nur per Link, Feed öffentlich |
| „Tegernsee Crew" | unlisted | request | unlisted + Antrag |
| „FSR-Trier Akaflieg (privat)" | private | invite_only | Feed nur Mitglieder |
| „Anfänger-Treff Schwäbische Alb" | public | open | beginner-orientiert |
| „Kärnten Soaring (privat)" | private | request | private + Antrag |

- Jede Gruppe: `slug` aus Name, `region` aus der Spot-Regionsliste, `tags` als JSON (z.B. `["alpen","streckenflug","anfaenger"]`), `members_count` **konsistent** zur tatsächlichen `group_members`-Zahl pflegen.
- `owner_user_id` = einer der 30 Piloten; Owner bekommt zusätzlich `group_members.role='owner'`.

**Channels (`conversations`):**
- Jede Gruppe automatisch **1** Default-Channel: `type='group_channel'`, `context_type='group'`, `context_id=group.id`, `title='Allgemein'`, `is_default=1`, `position=0`, `min_role='member'`.
- 2–3 Gruppen zusätzlich 1–2 Channels (`title` z.B. „Wetter", „Streckenmeldungen", „Orga-intern"), `position` aufsteigend; **1 Channel** mit `min_role='admin'` (testet Channel-Sichtbarkeit nach Rolle).

**Flugtreffen (`meetups`) — Zeit-/Status-Verteilung (kritisch für derived_status):**
- 25 Treffen, `spot_id` per Autocomplete-Logik zufällig aus `spots`; `region`/`lat`/`lng`/`spot_name` aus dem Spot **kopiert** (Denormalisierung, §4.2).
- `starts_at`-Verteilung: **~12 in der Zukunft** (`open`), **~8 in der Vergangenheit** (⇒ `finished` im Read), **~3 `status='cancelled'`** (verteilt Zukunft/Vergangenheit), **~2 ausgebucht** (`max_participants` klein gesetzt + genug `confirmed`-Teilnehmer ⇒ `full`).
- `experience_level`: Mischung inkl. einiger `all`.
- `visibility`: **alle `public`** im MVP (keine Gruppe↔Treffen-Verknüpfung, ADR-012/B5; `group`-Treffen sind vorbereitetes, ungenutztes Schema).
- Ersteller (`creator_user_id`) bekommt automatisch eine `meetup_participants`-Zeile (Organisator wird über `creator_user_id` abgeleitet — kein `role`/`status`-Feld, ADR-015) und **zählt zur Kapazität**.

**Treffen-Teilnahmen (`meetup_participants`):**
- Ø 4–6 `confirmed` je Treffen (ohne Doppelung dank `uq_meetup_user`).
- Bei den 2 ausgebuchten Treffen: `confirmed` = `max_participants`, plus 1–2 `waitlist` (demonstriert Warteliste + `full`).
- Vereinzelt `declined` (zeigt, dass Status sauberer Enum ist).

**Chat (`conversations`/`messages`/`message_reactions`) — „lebendig" wirken:**
- **Gruppen-Channels:** je Default-Channel **10–25** `messages` von verschiedenen Mitgliedern, deutsche Plaintext-Inhalte (Smalltalk, Wetter, Treffen-Absprachen) + Auto-Linkify-Beispiel (eine Nachricht mit URL).
- **Treffen-Chats:** je Treffen **3–10** Nachrichten; mind. eine vom `creator_user_id` (demonstriert `is_creator`-Hervorhebung, §6).
- **Direkt (`direct`):** ~10 DM-Konversationen zwischen zufälligen Paaren; `context_type/context_id=NULL`, `dm_key = minId_maxId` deterministisch, `uq_conv_dm_key` respektiert.
- **Reaktionen:** ~80 `message_reactions` auf zufällige Nachrichten, Emoji aus kleinem Set (👍 🔥 😂 🪂 ❤️), `uq_reaction` respektiert.
- **Soft-Edit/Delete (ADR-009):** ~5 Nachrichten mit `edited_at` gesetzt; ~5 mit `deleted_at` (Tombstone, `body` ggf. NULL, `deleted_by`=Sender oder Admin).
- **Reply:** ~10 Nachrichten mit `reply_to_id` auf eine frühere Nachricht derselben Konversation.
- **`conversation_participants`:** für jeden Channel = Gruppenmitglieder; für jedes Treffen = Teilnehmer; für DM = die 2 User. `last_read_message_id` bei einigen Teilnehmern **bewusst < letzter Nachricht** ⇒ erzeugt sichtbare **Unread-Zähler**. `last_message_at` auf der Conversation konsistent zur letzten Nachricht setzen (Sidebar-Sortierung).

**Benachrichtigungen (`notifications`, ADR-008):**
- ~50 Einträge, passend zu den geseedeten Aktionen, **polymorph** (`context_type`/`context_id` ohne FK).
- Typ-Mischung (nutzt die Beispiel-Keys §8.1.1): `meetup_join`, `meetup_cancelled`, `group_join_request`, `group_request_approved`, `group_invite`, `new_message`, `message_reaction`.
- **~40 % `read_at=NULL`** (ungelesen) ⇒ Badge-Zähler ist in der Demo sofort sichtbar > 0.
- `data`-JSON mit Render-Payload (z.B. `{"group":"Mosel & Eifel Flieger","actor":"Lena K."}`), damit das Notification-Center ohne Nachladen rendern kann.
- Mindestens einige Notifications für den **Admin-Account** und einige für einen klar benannten **Demo-Login-Piloten**, damit die Abnahme „eingeloggt als X" sofort etwas zeigt.

---

## 3) Seeder-Verantwortlichkeiten & Reihenfolge (FK-Abhängigkeiten)

Ein zentraler `DatabaseSeeder` ruft die Einzel-Seeder in **genau dieser Reihenfolge** auf (entspricht §10 DATA_MODEL). Jeder Seeder ist für **eine** Domäne zuständig und schreibt seine erzeugten IDs in einen gemeinsamen Kontext (z.B. statische Arrays / Helper), damit Folge-Seeder referenzieren können.

| # | Seeder | Schreibt in | Abhängig von | Verantwortung / Notizen |
|---|---|---|---|---|
| 0 | *(Shield-Setup)* | `users`, `auth_*` | — | Shield-Migrations **müssen gelaufen** sein. Gruppen `user`/`admin` existieren (ADR-004). |
| 1 | `AdminUserSeeder` | `users`, `auth_identities`, `auth_groups_users` | Shield | Erzeugt **1 Admin** (§4), weist Shield-Group `admin` zu. |
| 2 | `UserSeeder` | `users`, `auth_identities`, `auth_groups_users` | Shield | 30 Piloten via Shield-`UserModel` (E-Mail/Passwort in `auth_identities`!), Group `user`. **Niemals** `users.role` schreiben (existiert nicht). |
| 3 | `ProfileSeeder` | `profiles` | Users, (`spots` für `home_spot_id`) | 1:1 zu jedem User; `home_spot_id` erst setzbar, **nachdem** Spots existieren → daher Spots vor oder Spots-FK in 2. Pass. **Lösung:** SpotSeeder vor ProfileSeeder ausführen (siehe #4). |
| 4 | `SpotSeeder` | `spots` | — (regions optional) | Die 30 Spots aus §1. **Vor** ProfileSeeder einplanen, damit `home_spot_id` gesetzt werden kann. (Reihenfolge real: 1 Admin, 2 User, **4 Spots**, **3 Profiles** — oder Profiles ohne home_spot anlegen und in Nachlauf updaten.) |
| 5 | `GroupSeeder` | `groups` | Users (owner) | 8 Gruppen (§2.2-Tabelle), `slug`/`tags`/`visibility`/`join_policy`. |
| 6 | `GroupChannelSeeder` | `conversations` (`group_channel`) | Groups, Users | Je Gruppe Default-„Allgemein" (`is_default=1`) + Zusatz-Channels. **Kein** `group_messages` (ADR-005). |
| 7 | `GroupMemberSeeder` | `group_members` | Groups, Users | Owner (`role=owner`) + Mitglieder; pflegt `groups.members_count` konsistent. |
| 8 | `GroupJoinRequestSeeder` | `group_join_requests` | Groups (`join_policy=request`), Users | offene + entschiedene Anträge; `decided_by`=Owner/Admin. |
| 9 | `GroupInviteSeeder` | `group_invites` | Groups (`invite_only`), Users | gerichtete Einladung + 1 Token-Link (`token`, `max_uses`). |
| 10 | `FeedPostSeeder` | `feed_posts` | Groups, Users (author=owner/admin) | 2–4 je Gruppe, 1 `is_pinned`. |
| 11 | `MeetupSeeder` | `meetups` | Users, Spots, **Groups** (`group_id`) | 25 Treffen mit Zeit-/Status-Verteilung (§2.2); kopiert Spot-Geo. Nach Groups, da `group_id`-FK. |
| 12 | `MeetupParticipantSeeder` | `meetup_participants` | Meetups, Users | Organizer-Eintrag + Teilnehmer; respektiert `uq_meetup_user`, erzeugt `full`/`waitlist`. |
| 13 | `MeetupChatSeeder` | `conversations` (`meetup`) | Meetups, Users | 1 Conversation je Treffen (`context_type='meetup'`). |
| 14 | `DirectConversationSeeder` | `conversations` (`direct`) | Users | ~10 DMs, `dm_key=minId_maxId`, `uq_conv_dm_key`. |
| 15 | `ConversationParticipantSeeder` | `conversation_participants` | Conversations, Users (+ später Messages für `last_read_message_id`) | Mitglieder je Channel/Treffen/DM. `last_read_message_id` ggf. **im Nachlauf** nach MessageSeeder setzen (Zyklus-Hinweis §10 DATA_MODEL). |
| 16 | `MessageSeeder` | `messages` | Conversations, Users | ~400 Nachrichten, Replies, `edited_at`/`deleted_at`-Tombstones; setzt `conversations.last_message_at`. |
| 17 | `MessageReactionSeeder` | `message_reactions` | Messages, Users | ~80 Reaktionen, `uq_reaction`. |
| 18 | `UnreadBackfillSeeder` *(optional)* | `conversation_participants.last_read_message_id` | Messages | setzt einige `last_read_message_id` < Max ⇒ Unread-Zähler. |
| 19 | `NotificationSeeder` | `notifications` | Users (+ Kontext-IDs der obigen) | ~50 Notifications, ~40 % ungelesen, `data`-JSON. |

**Reihenfolge-Hinweise:**
- **Zyklus `conversation_participants.last_read_message_id` ↔ `messages`:** Participants zuerst **ohne** `last_read_message_id` anlegen (#15), nach `MessageSeeder` (#16) per Update nachziehen (#18) — analog zur Migrations-Empfehlung (§10 DATA_MODEL).
- **`home_spot_id`:** Da `ProfileSeeder` (#3) auf `spots` zeigt, muss `SpotSeeder` davor laufen **oder** Profiles ohne `home_spot_id` anlegen und nachträglich updaten. Empfohlen: tatsächliche Ausführungsreihenfolge `Admin → User → Spot → Profile → Group → …`.
- **Konsistenz-Pflege:** `members_count`, `last_message_at` und `participant_count`-relevante `confirmed`-Zahlen werden vom jeweiligen Seeder **mitgepflegt**, nicht nachträglich berechnet (kein Cron, ADR-002).
- **Faker-Seed** wird **einmal** im `DatabaseSeeder` gesetzt, damit alle Sub-Seeder denselben deterministischen Strom nutzen.

---

## 4) Demo-Admin-Account (Shield-Group `admin` per Seed)

Plattform-Rollen laufen ausschließlich über **Shield-Groups** (`auth_groups_users`) — es gibt **keine** `users.role`-Spalte (ADR-004, §2 DATA_MODEL). Der `AdminUserSeeder` (#1) legt den Admin über das Shield-`UserModel` an und weist die Group zu.

**Vorgeschlagene Zugangsdaten (nur Demo/lokal — vor Prod ändern):**

| Feld | Wert |
|---|---|
| E-Mail (in `auth_identities.secret`) | `admin@flightmeet.test` |
| Passwort | `FlightMeet!2026` |
| `username` | `admin` |
| `display_name` (profiles) | `FlightMeet Admin` |
| Shield-Group | `admin` |

**Seeder-Logik (Skizze, Shield-konform):**

```php
$users = auth()->getProvider();          // Shield UserModel
$admin = new \CodeIgniter\Shield\Entities\User([
    'username' => 'admin',
    'email'    => 'admin@flightmeet.test',
    'password' => 'FlightMeet!2026',
]);
$users->save($admin);
$admin = $users->findById($users->getInsertID());
$admin->addGroup('admin');               // Shield-Group, NICHT users.role
// danach: ProfileSeeder legt profiles-Zeile für $admin->id an (display_name = 'FlightMeet Admin')
```

**Hinweise:**
- E-Mail/Passwort landen über das Shield-`UserModel` automatisch in `auth_identities` (nicht in `users`) — **niemals** direkt in eine `users.password`-Spalte schreiben (existiert nicht).
- Zusätzlich **1 klar benannter Demo-Pilot** (z.B. `pilot@flightmeet.test` / `FlightMeet!2026`, Group `user`) als „normaler" Login für die Abnahme — bekommt einige Treffen-Teilnahmen, Gruppen-Mitgliedschaften, ungelesene Nachrichten und Notifications, damit „eingeloggt als Pilot" sofort etwas zeigt.
- **Sicherheits-/Abnahmehinweis:** Diese Klartext-Passwörter gelten **nur** für lokale Demo/SQL-Dump. Vor einem realen öffentlichen Betrieb (vgl. rechtlicher Vorbehalt ADR-008) zwingend ersetzen.

> **TODO (ADR-012/D4):** Vor der Abgabe festlegen, ob der **finale Admin-Login** dieselben Demo-Credentials nutzt oder dem Prüfer separat mitgeteilte, individuelle Zugangsdaten erhält.

---

## 5) Akzeptanzkriterien für den Seed (Abnahme-Checkliste)

Nach `composer build:frontend` + Migrations + `php spark db:seed DatabaseSeeder` muss gelten:

- [ ] **Login** als `admin@flightmeet.test` und als Demo-Pilot funktioniert (Session-Cookie, ADR-004).
- [ ] **Karte** zeigt ≥ 25 Marker (Spots) korrekt im DACH-Raum platziert.
- [ ] **Flugtreffen-Liste** enthält sichtbar alle abgeleiteten Status: mind. je 1× `open`, `finished`, `cancelled`, `full` (§4.2.1 DATA_MODEL).
- [ ] **Gruppen-Verzeichnis** zeigt `public`/`unlisted`-Gruppen; `private` nur für Mitglieder; alle 3 `join_policy`-Workflows (Direktbeitritt, Antrag, Einladung) sind durchspielbar.
- [ ] **Gruppen-Feed** ist gefüllt, mind. 1 gepinnter Post je Gruppe.
- [ ] **Chat:** mind. 1 Channel mit ≥ 10 Nachrichten (Keyset-Pagination greift), Ersteller-Hervorhebung im Treffen-Chat sichtbar, ≥ 1 editierte + ≥ 1 gelöschte Nachricht (Tombstone), Reaktionen sichtbar, mind. 1 DM-Konversation.
- [ ] **Unread-Badge** des Demo-Piloten ist > 0 (Chat **und** Notifications).
- [ ] **Notification-Center** zeigt gemischte, teils ungelesene Einträge mit gerendertem `data`-Payload.
- [ ] Seed ist **reproduzierbar** (gleicher Faker-Seed ⇒ gleicher SQL-Dump, ADR-002).
- [ ] Keine FK-Verletzung, keine Verletzung der UNIQUE-Constraints (§9 DATA_MODEL).
