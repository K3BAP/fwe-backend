# CLAUDE.md — FlightMeet

Guidance for AI agents working in this repository. Read this first, then consult `spec/` for depth.

> **Sprache:** Nutzer-sichtbare Strings sind **Deutsch**, technische Keys/Code/Error-Codes **Englisch**.
> Diese Datei ist auf Englisch; Code-Kommentare im Repo sind überwiegend Deutsch.

---

## 1. What this is

**FlightMeet** is a community platform for paragliding pilots (Gleitschirmflieger). Core domains:
**Flugtreffen** (meetups at launch sites), **Gruppen** (communities with feed + channels),
an app-wide **Chat**, **Profile**, and in-app **Benachrichtigungen** (notifications). It's a university
course project (module "fwe", Uni Trier) and ships to a shared university webspace.

- **Active branch: `flightmeet-react`** — all work happens here; it tracks `origin/flightmeet-react`
  (commit and push there, not directly to `main`).
- `main` holds only the **three CI4-appstarter origin commits** (`b74f0a4`) both projects branch off —
  it is an ancestor of `flightmeet-react`, so a PR against it merges fast-forward.
- The unrelated older sibling project (**City-Rallye**) lives on the **`city-rallye`** branch, not on
  `main`. Don't mix the two.
- **Build model = prototype-first (ADR-016):** a full UI was built on mock data first (M1), then each
  domain was wired to the real backend by flipping `USE_MOCKS.<domain>` (M2–M5). M6 = polish/seed/tests/
  deploy-prep. M1–M6 are complete.

## 2. Tech stack

| Layer | Tech |
|---|---|
| Backend | PHP 8.2+ (dev runs 8.5), **CodeIgniter 4.7** + **CodeIgniter Shield 1.3** (session auth) |
| DB | **MySQL 8** (via MAMP, `127.0.0.1:8889`, db `db_team15`, root/root) |
| Frontend | **React 19** + **TypeScript** + **Vite 8**, **Tailwind v4** + **DaisyUI v5** |
| FE libs | TanStack Query v5, Zustand v5, React Router v7, React Hook Form + **Zod v4**, Leaflet/react-leaflet, **motion** (Framer Motion) |
| Tests | PHPUnit (backend, MySQL test DB), Vitest + Testing-Library (frontend, light) |

**Deliberately NOT used** (locked, see ADRs): WebSockets/SSE/daemons (shared webspace can't run them →
realtime = polling), Supabase (a Supabase MCP is connected but unused), JWT (Shield session cookie), cron.

**Only outbound HTTP calls:** the Open-Meteo weather proxy (ADR-017) and the Gemini briefing proxy
(ADR-018), both via CI4 `service('curlrequest')`. **That service is a shared singleton** — the first
creator wins its constructor options, so a second consumer must use absolute URLs + per-request options.

## 3. Repository layout

```
app/                      CodeIgniter backend
  Controllers/Api/
    BaseApiController.php  Envelope helpers: respondData/respondNoContent/respondError/fromException/
                          currentUserId/respondMaybeCached(ETag/304)
    V1/                   Thin controllers: Auth, Profile, Spot, Meetup, Group, Conversation,
                          Notification, Health
  Services/               Business logic + Presenters (DTO shaping). *Service = logic/transactions,
                          *Presenter = output mapping to the exact frontend Zod shape
    Admin/                ADR-019: UserAdmin/GroupAdmin/SpotAdmin/Stats services + AdminPresenter +
                          UserLookup (batched PublicUserCards — never a per-row lookup)
  Models/                 CI4 array models (returnType=array, useTimestamps=false mostly)
  Filters/                ApiAuthFilter (→JSON 401; also enforces `active` →403), ApiCsrfFilter (GET
                          passthrough), ThrottleFilter (→429), AdminFilter (Shield group `admin` →403)
  Libraries/              ApiExceptionHandler (api/* paths → error envelope)
  Exceptions/ApiException.php  Factories: notFound/forbidden/conflict/validation (errorCode,message,status,fields)
  Database/Migrations/    Schema = source of truth (20 migrations, MySQL-specific)
  Database/Seeds/DatabaseSeeder.php  Hand-curated deterministic demo seed (no Faker)
  Config/                 Routes.php, Events.php (UTC tz pin!), App.php (baseURL), Filters.php
frontend/                 React SPA (Vite)
  src/
    api/                  Typed Query hooks per domain (auth/profiles/spots/meetups/groups/chat/
                          notifications/users) + http.ts (apiFetch + envelope + CSRF + ETag cache) +
                          queryKeys.ts + schemas/ (Zod DTOs, the binding API contract)
    components/           ui/ (design system), layout/, auth/, meetups/, groups/, chat/,
                          notifications/, profile/, map/, dashboard/
    routes/               Pages + router.tsx (RequireAuth/RequireGuest/RequireAdmin guards) + lazy.tsx
      admin/              ADR-019 admin area (AdminLayout + 5 pages; lazy — dead code for non-admins)
    mocks/                Per-domain mock stores (used when USE_MOCKS.<domain> = true)
    stores/               Zustand: authStore (session mirror), uiStore (theme), toastStore
    lib/                  cn, format (de-DE), theme, queryClient, mediaUrl, useDialogA11y
    config.ts             USE_MOCKS (per domain) + ANY_MOCK + POLL intervals
    test/                 Vitest setup
spec/                     THE specification (read before extending) — see §13
tests/feature|unit/       PHPUnit tests
deploy/                   db_team15.sql (generated dump, gitignored)
public/                   Web root + Vite build output (gitignored build artifacts)
env / env.prod / .env     CI4 env template / prod config (gitignored) / local config (gitignored)
composer.json             Backend deps + scripts (test, build:frontend, deploy:local, deploy:remote)
```

## 4. Architecture & cross-cutting patterns

**Layering (ADR-013 — readable code is first-class):**
`Controller (thin: validate + authorize + delegate) → Service (logic, transactions) → Presenter (DTO) →
Model`. Controllers must stay thin; no god classes.

**API:** all routes under `/api/v1` (auto-routing off). Response **envelope**: success `{data, meta?}`,
error `{error: {code, message, fields?}}`. `error.code` is English & stable; `error.message` German.
HTTP status from the catalogue in `spec/06-backend-deployment.md` §3.

**Auth:** CodeIgniter **Shield**, session authenticator, **HttpOnly cookie** (no JWT). `auth` filter
guards protected routes. **CSRF = session mode**: SPA GETs `/auth/csrf` → `{data:{token}}`, sends it as
`X-CSRF-TOKEN` on writes; the token **rotates on login**, so `apiFetch` refetches + retries once on
`csrf_invalid`. Public GET routes (spots, groups, meetups read, csrf, register, login) live **outside**
the `auth` group.

**Data-access seam (ADR-016):** every domain has Zod DTOs in `frontend/src/api/schemas/` →
a mock store in `src/mocks/` → a typed hook in `src/api/<domain>.ts` that branches on
`USE_MOCKS.<domain>`. **The committed frontend Zod shape is the binding API contract** — the backend
Presenter emits *exactly* that shape (Zod strips extras). All domains are now `false` (live);
`ANY_MOCK` drives the "Mock-Daten" pill (currently gone).

**Polymorphic chat engine (ADR-005):** one set of tables —
`conversations(type: group_channel|meetup|direct)` + `conversation_participants` + `messages` +
`message_reactions` — for all chat. **Access is membership-driven** (DM = cp row; group_channel = active
`group_members` + `min_role`; meetup = `meetup_participants`), not cp-driven. `conversation_participants`
carries the read-watermark + `muted`.

**Notifications (ADR-008/012):** `NotificationService` is **best-effort** — called *after* the core
transaction inside try/catch, never rolls the core action back. `new_message` is **aggregated** (one
unread row per conversation, resolved on read). Text + link are rendered server-side in
`NotificationPresenter` from `type` + `actor` + `data` JSON.

**Realtime = polling + ETag/304 (ADR-001):** React Query `refetchInterval` (see `POLL` in config.ts:
active thread 2.5s, lists/unread 20s; paused at `document.hidden`). `apiFetch` does transparent
conditional-GET (per-URL ETag cache; 304 → cached). `BaseApiController::respondMaybeCached()` issues the
ETag and returns 304 on `If-None-Match` (it **skips 304 under the PHP dev-server** — so preview always
sees 200 full; real 304 is covered by PHPUnit + prod Apache).

**Prod base path:** the app is served under **`/public/`** on prod. All root-absolute client URLs derive
from `import.meta.env.BASE_URL` (`API_BASE`, `lib/mediaUrl.ts`, router `basename`). Dev = `/`, prod =
`/public/`. When adding any absolute client URL, derive it from BASE_URL.

**Admin role:** Shield group `admin` = a **site-admin override** on BOLA checks (services take an
`$isAdmin` param — `BaseApiController::isAdmin()` supplies it; Presenters set `can_edit`/`can_manage`
true for admins). `/auth/me` (+login/register) emit `is_admin` → `authStore.user.isAdmin` → TopBar badge
+ `RequireAdmin` guard. Chat still has **no** admin override (ADR-005, deliberate).

**Admin dashboard (ADR-019):** `/admin` (lazy, `RequireAdmin`) with overview/users/meetups/groups/spots;
API under `/api/v1/admin/*` behind `['csrf','auth','admin']` (`AdminFilter` → 403). The load-bearing
idea: it adds **two read endpoints, not ten write endpoints** — meetup/group writes reuse the existing
`$isAdmin` routes, so only users and spots got new write surface. Account deletion is **Shield soft-delete
only** (reversible; no cascade fires, so the person's content survives — say so, the delete dialog does).
Three 409 self-protections (`admin_self_demote|_deactivate|_delete`) yield the invariant **≥1 admin**.
`ApiAuthFilter` now checks `active` **per request** (403 `account_suspended`) — before, a suspended user's
open session ran on forever. No content moderation, and no mock store for this domain (see §7).

## 5. Domains & features

| Domain | Backend | Key behaviors |
|---|---|---|
| **Auth/Profile** | Auth/Profile Controller, AuthService, ProfilePresenter, UploadService | register/login/logout/me; `GET /users/{id}` reduced-vs-extended; `GET/PATCH /me/profile` (self-only BOLA); avatar upload (GD → 512+128 webp, EXIF-stripped, no-exec). handle/username required+unique. |
| **Flugtreffen/Spots** | Meetup/Spot Controller, MeetupService, MeetupPresenter | list (server-side filter/sort/page, correlated participant_count); join/leave (`SELECT … FOR UPDATE` + UNIQUE backstop, idempotent); create/edit/cancel/delete (creator or admin); `status` persists only `open|cancelled`, **`full`/`finished` derived on read** (`derived_status`); `max_participants` nullable = unlimited; **hard delete**. Curated `spots` (30 DACH sites), no geocoding. |
| **Gruppen** | GroupController, GroupService, GroupPresenter | `visibility` (public/unlisted/private) × `join_policy` (open/request/invite_only); roles owner/admin/moderator/member; join/request/approve/reject; directed + token invites (accept/preview backend-only, no UI yet); feed (broadcast posts + emoji reactions, soft-delete); **soft-delete** group; denormalized `members_count` recomputed on every membership change. |
| **Chat** | ConversationController, ChatService, ChatPresenter | polymorphic (DM/channel/meetup); send/edit (15-min window)/delete (tombstone, body kept)/react (toggle)/markRead/openDm (find-or-create, `dm_key=min:max`); group channels have a dedicated UI (`/gruppen/:id/channels`) and are **excluded** from the global chat list. |
| **Benachrichtigungen** | NotificationController, NotificationService, NotificationPresenter | list/unread-count/markRead/markAllRead; 8 types: meetup_join, meetup_cancelled, group_join_request, group_request_approved, group_invite, new_message, message_reaction, group_feed_post. |
| **Wetter** | MeetupController::weather, WeatherService, WeatherPresenter | `GET /meetups/{id}/weather` (public, `throttle:weather,30`) — **Open-Meteo proxy** (ADR-017, no API key). Server derives lat/lng + `starts_at` from the meetup row (client sends nothing); `timezone=UTC` so the hourly axis matches the DB directly. FileCache 30 min, key = coords rounded to 2 decimals + date window. Panel shows ground wind (10 m) + gusts (color-coded), temp, rain, cloud, WMO code, nullable 850 hPa wind / CAPE, plus a 6-hour wind trend. **Unavailability is data, not error:** `past` (2 h grace) / `out_of_range` (>16 d) / `no_location` → `200 {available:false, reason}` with **no** upstream call; only a real outage → `503 weather_unavailable`. |
| **KI-Briefing** | MeetupController::briefing, BriefingService, Config\Gemini | `GET /meetups/{id}/briefing` (public, `throttle:briefing,10`) — **Gemini proxy** (ADR-018). On-demand button in the WeatherPanel; 2–3 German sentences summarizing the ADR-017 weather DTO. Key server-side only (`gemini.apiKey` in `.env`, get one at aistudio.google.com/apikey); prompt contains **only curated data** (no user text → no injection surface); system instruction forbids fly/no-fly wording; UI labels output "KI-generiert … keine Flugfreigabe". Cache 30 min keyed to the weather target hour; failures never cached. No key → `200 {available:false, reason:'not_configured'}`; weather reasons pass through; real outage → `503 briefing_unavailable` (429 upstream → "ausgelastet" message). Default model `gemini-flash-lite-latest` (evergreen lite alias — older model IDs are closed to new keys, and non-lite flash models "think" 12–15 s even on tiny prompts, blowing the 15-s timeout). No `thinkingConfig` (its params are incompatible across model generations); instead `maxOutputTokens: 1024` headroom, because flash models bill internal "thinking" tokens against the budget and a tight limit truncates the text. |
| **Landing** | (frontend only) | guest marketing page at `/landing`: full-screen sky hero + sticky nav (transparent→solid, smooth-scroll anchors) + features + **live public groups** (`GET /groups`, guest-accessible) + popular spots + CTA. |
| **Admin** | `Api/V1/Admin/{Overview,User,Meetup,Group,Spot}Controller`, `Services/Admin/*` | ADR-019. `/admin/stats` (counts); users (list w/ email+role+counts, edit profile, toggle admin, suspend, soft-delete+restore, 3× self-protection 409); meetups + groups **read-only** (groups incl. private/deleted + restore); spots CRUD (`lat`/`lng` set via a Leaflet picker, **no geocoding** — that would be a third outbound service; ≠ the deferred "Map-Picker für freie Spots", which is about *users* choosing unlisted places). Writes for meetups/groups go through the **existing** public routes. |

## 6. Data model (high level)

Schema lives in `app/Database/Migrations/` and is the **operational** truth; `spec/DATA_MODEL.md` is the
**binding design** truth. ~25 tables (incl. Shield auth/settings tables): `profiles`, `ci_sessions`, `spots`, `meetups`,
`meetup_participants`, `groups`, `group_members`, `group_join_requests`, `group_invites`, `feed_posts`,
`feed_post_reactions`, `conversations`, `messages`, `conversation_participants`, `message_reactions`,
`notifications`.

Race/uniqueness backstops (tested in `RaceSafetyTest`): `uq_meetup_user`, `uq_conv_dm_key`,
`uq_group_user`, reaction uniques. Emoji-unique columns use **`utf8mb4_bin`** (else 👍≡🔥 collate equal).
`messages` uses **TIMESTAMP(3)** + a generated `conversations.meetup_uniq` STORED column (raw SQL — Forge
can't). `users.id` is BIGINT (migration 120000 rebuilds Shield FKs).

## 7. Repo conventions

- **Code quality (ADR-013):** clean, readable, no god classes. The maintainer reviews intensively and
  must defend the code. Match the surrounding style; thin controllers; meaningful German comments.
- **Strings:** user-facing = German; technical keys, enums, error codes, DB columns = English.
- **Types:** Zod schemas are the type source of truth on the frontend (`z.infer`). Schemas split per
  domain under `src/api/schemas/` with an `index.ts` barrel — import via `@/api/schemas` (the `@` alias = `src/`).
- **Backend ↔ frontend contract:** the Presenter output must equal the committed frontend Zod shape
  exactly. If they ever diverge, the committed frontend wins; reconcile the spec, don't bend the FE.
- **Seam additions:** new domain → schema + hook. A mock store **only when the UI precedes the backend**
  (the ADR-016 M1 pattern, hook branching on `USE_MOCKS`); domains built backend-first (e.g. `admin`)
  don't get one — it would be code no path ever reaches. The typed DTO contract is the half that matters.
- **Endpoints:** specific route segments before `(:num)`; write methods inside the `['csrf','auth']` group.
- **Frontend gate before commit:** `npm run typecheck` + `npm run lint` + `npm run test` must be green.
  Tests are decoupled from the build (`tsconfig.app.json` excludes `*.test.*`; `tsconfig.vitest.json` types them).
- **Animations/a11y:** all motion gated by `useReducedMotion`; dialogs use `lib/useDialogA11y` (focus
  trap + restore + Escape + scroll-lock). Never use fixed ramp colors (e.g. `sky-700`, `bg-sky-50`) for
  theme-adaptive surfaces/text — use DaisyUI tokens (`text-primary`, `bg-primary/10`, `base-content`),
  else dark mode breaks. Fixed brand gradients (hero/CTA images) are fine.
- **Commits:** only when the user asks (per-milestone slices were pre-authorized). Conventional-commit
  style, German body. End commit messages with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Secrets:** never echo or commit `.env`, `env.prod`, `.deploypass`, `encryption.key`, or the prod DB
  password. `deploy/` and `public/` are gitignored. Demo passwords (`passwort123`, `FlightMeet!2026`) are
  local/demo-only.

## 8. Local development

Prereqs: MAMP running (MySQL on `127.0.0.1:8889`, db `db_team15`, root/root). Local `.env` configured
(copy from `env`; CI4 reads `.env`).

```bash
# Backend (CI4 dev server)
php spark serve --port 8080          # serves /api + /media; uses MAMP MySQL :8889

# Frontend (Vite dev server, in a second shell)
cd frontend && npm install           # first time
npm run dev                          # http://localhost:5180 — proxies /api + /media → :8080
```

Vite dev base = `/`. The SPA hits `/api/v1/...` (proxied). Demo logins: `lena@flightmeet.test` /
`passwort123` (normal pilot, filled UI) and `admin@flightmeet.test` / `FlightMeet!2026` (Shield admin).

For the KI-Briefing (ADR-018): put `gemini.apiKey = '…'` into the local `.env` (free key from
https://aistudio.google.com/apikey; never commit it). Without it the endpoint answers `not_configured`
and the UI shows a quiet fallback — everything else works.

> **mysql CLI is NOT on PATH** — it's at `/Applications/MAMP/Library/bin/mysql80/bin/mysql`
> (and `mysqldump` beside it).
> **zsh does not word-split unquoted variables** — don't do `M="mysql -e"; $M -e "..."` (→ exit 127);
> write the full command inline.

## 9. Testing

```bash
composer test                        # PHPUnit — 325 backend tests (MySQL test DB db_team15_test)
                                     # (composer's 300-s process timeout can trip → run `vendor/bin/phpunit` directly)
cd frontend && npm run test          # Vitest — 52 smoke tests (schemas, lib/format, Badge/Table render)
cd frontend && npm run typecheck     # tsc -b
cd frontend && npm run lint          # eslint
```

- Backend tests use a **MySQL** test DB `db_team15_test` (configured in `phpunit.xml.dist`, charset
  `utf8mb4`) — NOT SQLite (migrations are MySQL-specific). PHPUnit `$refresh=true` runs migrations fresh
  per run but **does not** run `DatabaseSeeder` → tests self-seed via helpers (`createPilot`/`createMeetup`/…).
- If the test DB vanished after a MAMP restart ("Unknown database"):
  `CREATE DATABASE IF NOT EXISTS db_team15_test CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`
- `respondNoContent()` = real **204** under PHPUnit/prod, but **200 `{data:null}`** under `php spark serve`
  (the dev server emits a malformed 204 the Vite proxy rejects). Assert accordingly.
- Outbound HTTP is faked via `Services::injectMock('curlrequest', FakeCurlRequest::returning(...))`
  (`tests/_support/Libraries/`); `::routing([...])` maps URL substrings to responses when one flow hits
  several upstreams (briefing = forecast + generateContent); `calls`/`callsByRoute` assert the
  cache/no-upstream paths. Gemini config in feature tests via `Factories::injectMock('config', 'Gemini', $cfg)`.
- **`actingAs()` is in-memory only** — in feature tests there is no real session (it's empty), the
  `auth` singleton *is* the session. So `Services::resetSingle('auth')` doesn't simulate a fresh
  request, it just logs you out; and a `users` row change won't reach `auth()->user()`. To test
  per-request user state (e.g. the `active` check), re-`actingAs()` the **reloaded** entity — that's
  what a real request does, where `Session::checkUserState()` re-reads via `findById()`.
  See `AdminAccessTest`.
- **Throttled routes in feature tests:** CIUnitTestCase injects a **fresh MockCache per test**, but the
  `Services::throttler()` singleton keeps the cache instance of its *first* creation and counts there
  for the whole PHPUnit process — `cache()->clean()` does **not** reset buckets (it cleans the wrong
  instance; tests never touch `writable/cache/`). Call `Services::resetSingle('throttler')` in `setUp`
  (see MeetupBriefingTest), or requests 11+ against a `throttle:*,10` route 429 suite-order-dependently.

## 10. Database & migrations

```bash
php spark migrate --all              # run all migrations across namespaces (Shield → Settings → App)
php spark db:seed DatabaseSeeder     # hand-curated deterministic demo data
```

> **NEVER `php spark migrate:refresh`** — it rolls back across namespaces (drops Shield `users`) then
> re-migrates App before Shield → "Table users doesn't exist". To reset the dev DB:
> ```bash
> /Applications/MAMP/Library/bin/mysql80/bin/mysql -h127.0.0.1 -P8889 -uroot -proot \
>   -e "DROP DATABASE IF EXISTS db_team15; CREATE DATABASE db_team15 CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"
> php spark migrate --all && php spark db:seed DatabaseSeeder
> ```
> A DB reset invalidates the preview session → log in again.

Seed = 1 Shield admin + 15 pilots, 30 spots, 8 groups (all visibility×join_policy), 18 meetups (all
derived statuses), curated chat + ~22 notifications. Pilot **array indices 0/1/2 = Lena/Markus/Sophie**
are referenced by group/meetup membership — keep them stable; append new users.

## 11. Deploy (shared university webspace, ADR-002)

**Constraints:** SFTP-only (no SSH), **no `spark migrate` on prod**, schema goes in via **phpMyAdmin SQL
dump**, no cron, no daemons. Full runbook: `spec/06-backend-deployment.md` §13.1–13.4.

```bash
# 1. fresh deterministic dump (schema + seed) — see §10 to reseed first
rm -rf public/assets && composer build:frontend         # clean stale chunks (emptyOutDir:false), prod build → public/ (base /public/)
/Applications/MAMP/Library/bin/mysql80/bin/mysqldump --no-tablespaces --skip-comments \
  --single-transaction --default-character-set=utf8mb4 -h127.0.0.1 -P8889 -uroot -proot db_team15 > deploy/db_team15.sql
# 2. (once) place env.prod content as server .env via SFTP
# 3. composer deploy:remote        # lftp mirror → /web/  (reads .deploypass)
# 4. import deploy/db_team15.sql via phpMyAdmin
```

`build:frontend` MUST precede `deploy:remote`. `.deployignore` excludes `frontend/`, `deploy/`, secrets,
and **preserves `public/media/uploads/`** (else `lftp --delete` wipes uploaded avatars). D3 (test SMTP /
upload quota / ETag-304 on the real webspace) and D4 (admin login for grading) are documented in the runbook.

## 12. Gotchas / durable lessons

- **Never flip a `<button>`'s `type` between renders.** A conditional `type="button"` (Weiter) vs
  `type="submit"` (Absenden) in the *same* JSX slot makes React recycle one DOM node and only swap the
  attribute — mid-click. The browser evaluates a click's default action **after** the microtask queue
  drains, by which time React has already written `type="submit"`, so the form submits. That is why the
  meetup wizard's step-2 "Weiter" silently created the meetup and step 3 ("Details") was unreachable for
  *every* user: `max_participants`/`description` could not be set at all. Fix = distinct `key`s on the two
  buttons (forces two DOM nodes; see `MeetupForm.tsx`). jsdom does **not** reproduce this — a Vitest click
  test would pass while the app is broken, so verify this class of bug in a real browser.
- **`meetups.spot_id` is nullable in practice** (`ON DELETE SET NULL`), while `spot_name`/`region`/`lat`/
  `lng` stay as a snapshot on the row. The Zod side must say `.nullable()`, or every meetup at a deleted
  spot fails `parse()` and the detail page renders "Treffen nicht gefunden" **though the API answered 200**.
  Deleting a spot in `/admin/spots` is exactly the path that produces this (ADR-019).
- **Timezone:** `Config/Events.php` pins the MySQL session to `+00:00` on `pre_system` (all envs). Without
  it, `CURRENT_TIMESTAMP` defaults store local time while the app assumes UTC → broke the 15-min edit
  window, displayed +2h, mis-sorted notifications. Keep the pin.
- **HMR storms:** editing many files while interacting with the Vite preview can race (a click hits a page
  mid-reload). After a batch of edits, let HMR settle (or hard-reload) before driving the preview. The
  preview console buffer also keeps stale errors across reloads — check the freshly-rendered DOM, not just the buffer.
- **DATA_MODEL.md is the binding schema arbiter**, above the domain chapters, when they disagree.
- Backend emits the **exact** committed-frontend Zod shape (flat fields, PublicUserCard, etc.) — not the
  older nested examples in some spec chapters.
- `feed_posts.updated_at` has `ON UPDATE CURRENT_TIMESTAMP` → presenter emits it only when `!= created_at`
  (real edit), else the UI shows "· bearbeitet" forever.
- **Shield's `UserModel::$allowedFields` is `username,status,status_message,active,last_active` — `deleted_at`
  is NOT in it.** So `model(UserModel::class)->update($id, ['deleted_at' => null])` **silently drops the
  field and no-ops**: no error, restore just doesn't happen. Un-deleting must use the raw query builder
  (`UserAdminService::restore()`); `->delete($id)` for soft-delete is fine (uses `deletedField`).
- **MySQL types over the wire:** `SUM()`/`COUNT()` come back as **strings**, `DECIMAL` as a **string**,
  booleans as `0`/`1`. Zod's `z.number()`/`z.boolean()` reject all three → presenters must cast
  (`(int)`, `(float)`, `(bool)`). The schema tests in `api/schemas/admin.test.ts` pin this down.
- `` `group` `` is a reserved MySQL word — backtick it when touching `auth_groups_users`.

## 13. The spec (`spec/`) — read before extending

| File | Contents |
|---|---|
| `TARGET_SPEC.md` | main spec overview |
| `DECISIONS.md` | **ADR log (ADR-001…019)** — the locked architectural decisions; read this |
| `DATA_MODEL.md` | binding schema design |
| `API.md` | endpoint catalogue |
| `01..06-*.md` | per-area chapters (auth/profil, flugtreffen, gruppen, chat-realtime, frontend, backend-deployment) |
| `MILESTONES.md` | M0–M6 plan + acceptance |
| `SEED_DATA.md` | demo-data spec |
| `DESIGN.md` / `DESIGN_BRIEF.md` / `design/` | design tokens + Claude-Design draft (`.dc.html` + screenshots) |
| `OFFENE_FRAGEN.md` | open-questions log |

Key ADRs to know: 001 polling (not websockets), 002 deploy/migrations (SFTP + SQL dump), 004 Shield
session auth, 005 polymorphic chat engine, 006 group visibility×join_policy, 008 scope (notifications in;
email/moderation deferred), 012 (A1 bigint id, A2 timestamp(3), A4 spots admin/seed-only, C6 15-min edit,
C7 aggregated unread, D3/D4 deploy TODOs), 013 readable code, 016 prototype-first seam, 017 weather via
Open-Meteo proxy, 018 Gemini flight briefing (key in `.env`, describe-never-clear stance),
019 admin dashboard (soft-delete only, ≥1-admin invariant, governs accounts not speech).

## 14. Status

M1–M6 complete and pushed to `origin/flightmeet-react`. Backend 325 PHPUnit green, frontend 52 Vitest green.
Post-MVP: weather on the meetup detail page (ADR-017), Gemini flight briefing (ADR-018), **admin dashboard
(ADR-019)**.

**Live on prod** (https://team15.wi1cm.uni-trier.de/public/, last deploy 16.07.2026, incl. ADR-017/018).
D3 verified on the real webspace: outbound HTTPS + `ext-curl` work (Open-Meteo **and** Gemini reachable),
FileCache writable, ETag→`304` passes through Apache. Prod `.env` carries `gemini.apiKey`, so the briefing
is live there; the previous config is backed up server-side as `/web/.env.bak-20260716-155350` (delete once
you're satisfied — a later `mirror --delete` would drop it anyway).

**Deferred / open:** content moderation (chat/feed) — deliberately out (ADR-005/019: the dashboard governs
accounts and entities, not speech); group invite-accept UI (backend ready); design-alignment of
chat/notification/groups pages to the prototype. D3 leftovers: avatar
upload quota/no-exec on the webspace, SMTP (both untested; e-mail flows are out of MVP scope anyway).
**ADR-019 is not deployed yet** — it landed after the 16.07.2026 deploy; needs `build:frontend` +
`deploy:remote` (no migration: it uses Shield's existing `deleted_at`/`active` columns).
The prod DB seed dates from 26.06.2026 — only ~5 meetups are still in the future, so re-seed + re-import
via phpMyAdmin before a demo if you want a fuller weather/briefing showcase. Low-priority: muted-text
contrast bump (`text-base-content/55` ≈ 4:1, just under AA); dev-only `vite` advisory.
