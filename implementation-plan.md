# City-Rallye App — Implementation Plan

## Context

The Fachschaftsrat Informatik (Uni Trier) needs an app to run city rallyes: teams of participants
visit stations ("Stationen") around town and solve location-based tasks. Admins set up rallyes and
tasks, share a join link/QR, evaluate answers, and run on-site scoring; participants join (optionally
forming teams), solve tasks, and watch a live leaderboard.

The repo is a **stock CodeIgniter 4.7 appstarter** (PHP 8.5, MySQL DB `db_team15` already created,
Node 26 available). `frontend/` is empty and `public/` is empty except CI4's front controller — the
built SPA will be served from `public/`. Two deploy scripts exist (`composer deploy:local` → MAMP,
`deploy:remote` → uni webspace); `.deployignore` already excludes the `frontend/` source.

**Confirmed decisions:**
- **Scoring:** every task has an admin-set `max_points`. Auto-graded correct = max, wrong = 0.
  Rank-based tasks (time races, numeric estimate) scale rank to max. Physical-game = admin enters raw
  points (capped at max). Single comparable scale across all task types.
- **Live updates:** polling via TanStack Query `refetchInterval` (no websockets/SSE — works on shared
  uni webspace).
- **Task types:** multiple-choice, exact-text/code, numeric-estimate, free-text, photo-upload,
  GPS-check-in, on-site-time, on-site-points.
- **Auth:** stateless opaque bearer tokens for both admins and participants; SPA builds into `./public`,
  API mounted under `/api`.
- **All user-facing strings in German.**

## Architecture overview

```
/ (CodeIgniter root)
├── app/                 ← CI4 REST API (Controllers/Models/Services/Filters/Migrations/Seeds)
├── public/              ← CI4 front controller + built SPA (index.html, assets/) — deploy target
├── frontend/            ← Vite React SPA source (excluded from deploy via .deployignore)
├── sql/                 ← schema.sql + seed_trier.sql (run via phpMyAdmin)
└── docs/                ← DOCUMENTATION.md (capabilities overview)
```

Dev: Vite dev server (`:5173`) proxies `/api` → CI4 (`:8080`) so there are no CORS issues and prod is
same-origin. Prod: `npm run build` (base `/`) emits into `../public`; `.htaccess` serves API via CI4,
static assets directly, and SPA deep-links fall back to `index.html`.

---

## Part 1 — Database (`/sql`)

`sql/schema.sql` (DDL, utf8mb4) with tables:

- **admins** — `id, username (unique), password_hash, created_at`.
- **admin_tokens** — `id, admin_id FK, token (unique), expires_at, created_at` (opaque session tokens).
- **rallyes** — `id, title, description, theme, join_code (unique slug for link/QR), status
  ENUM(draft,active,finished), teams_enabled TINYINT, max_team_size NULL, preset_team_count NULL,
  created_by FK→admins, created_at, started_at, ended_at`.
- **teams** — `id, rallye_id FK, name, is_solo TINYINT (true for no-teams auto-teams), created_at`.
- **participants** — `id, rallye_id FK, team_id FK NULL, display_name, token (unique, = their identity),
  created_at`. Re-issuable token powers the "admin sends new login link" feature.
- **tasks** — `id, rallye_id FK, type ENUM(...8 types), title, prompt, position INT, max_points INT,
  config JSON, created_at`. `config` holds type-specific settings (choices + correct index; accepted
  exact answers; target number + tolerance; sample solutions list; gps lat/lng/radius_m). Kept as a
  cast JSON column for flexibility across types — no per-type child tables.
- **submissions** — one row per `(task_id, team_id)` (teams answer once, immutable):
  `id, task_id FK, team_id FK, participant_id FK (who submitted), answer_text NULL, answer_number NULL,
  answer_choice NULL, photo_path NULL, raw_value NULL (seconds for time / points for game / estimate),
  status ENUM(pending,correct,incorrect,evaluated), awarded_points NULL (persisted for deterministic &
  admin-decided types; NULL for rank-based, computed on read), evaluated_by FK NULL, submitted_at,
  evaluated_at`. Unique key `(task_id, team_id)` enforces single-answer.

`sql/seed_trier.sql` — one Trier-themed active rallye ("Trier Entdecker-Rallye") with a sample admin
(`admin`/bcrypt hash documented in DOCUMENTATION.md), teams enabled, and ~6 stations covering the task
types: Porta Nigra (multiple-choice), Dom (exact-text code on a plaque), Hauptmarkt fountain
(numeric-estimate of figure count), Karl-Marx-Haus (free-text), Römerbrücke (photo-upload),
Kaiserthermen (gps-check-in), plus an on-site-time sprint and an on-site-points Flunkyball station.

---

## Part 2 — Backend API (`app/`)

**Config changes:** set `app.baseURL`; add a `Bearer` auth filter alias in `Config/Filters.php`;
add API routes in `Config/Routes.php` under a `group('api')`; enable DB creds via `.env`.

**Filters** (`app/Filters/`):
- `AdminAuthFilter` — validates `Authorization: Bearer` against `admin_tokens`, sets current admin.
- `ParticipantAuthFilter` — validates token against `participants`.

**Models** (`app/Models/`, CI4 `Model` with validation + JSON casts): `AdminModel`, `AdminTokenModel`,
`RallyeModel`, `TeamModel`, `ParticipantModel`, `TaskModel`, `SubmissionModel`.

**Services** (`app/Services/` registered in `Config/Services.php`) — domain logic kept out of
controllers:
- `AuthService` — admin login (verify bcrypt, issue token), participant create/re-issue token.
- `GradingService` — grades a submission at submit time for deterministic types (MC, exact-text via
  normalized compare, gps via haversine vs radius, free-text auto-match against sample solutions →
  else `pending`). Sets `status` + `awarded_points`.
- `ScoringService` — computes leaderboard + per-task results **on read**: sums persisted
  `awarded_points` and recomputes rank-based points (time, numeric-estimate) across all teams so totals
  stay correct as new submissions arrive. Time: fastest = max_points, scaled `(n-1-rank)/(n-1)`.
  Numeric: smallest absolute error = max, same rank scaling.

**Controllers** (`app/Controllers/Api/`, extend `ResourceController`, JSON):
- `AuthController` — `POST /api/admin/login`, `POST /api/admin/logout`,
  `POST /api/rallyes/:code/join` (create participant, return token), `POST /api/participants/reissue`.
- `RallyeController` — public `GET /api/rallyes/:code` (join screen info); admin CRUD on rallyes,
  status transitions (draft→active→finished).
- `TaskController` — admin CRUD on tasks (validates `config` per type); participant `GET` task list
  (answers/correct solutions stripped) for their rallye.
- `TeamController` — list teams for a rallye, participant create/join team (enforces `max_team_size` /
  `preset_team_count`), solo-team auto-creation when teams disabled.
- `SubmissionController` — participant `POST` answer (immutable, graded via `GradingService`); admin
  evaluation queue `GET /api/rallyes/:id/pending` + `POST /api/submissions/:id/evaluate`; on-site
  `POST /api/submissions/onsite` (resolve team via scanned QR token, set raw_value).
- `LeaderboardController` — `GET /api/rallyes/:id/leaderboard` (polled), `GET .../results` per-team.
- `AdminUserController` — admin account management (list/create/delete admins).

**Uploads:** photos stored under `writable/uploads/`, served via a controller endpoint (auth-checked).

---

## Part 3 — Frontend SPA (`frontend/`)

Scaffold **Vite + React + TypeScript**. Stack: **Tailwind CSS**, **Zustand** (auth/session + active
rallye id), **TanStack Query** (all remote state + polling), **React Router**, **vite-plugin-pwa**
(installable PWA + offline shell), a QR **generator** (`qrcode.react`) and camera **scanner**
(`@yudiel/react-qr-scanner`), `react-hook-form` for admin forms.

`frontend/vite.config.ts`: `base: '/'`, `build.outDir: '../public'`, `emptyOutDir: false` (preserve
CI4 `index.php`/`favicon`), dev `server.proxy['/api'] → http://localhost:8080`.

**Structure:** `src/api/` (typed fetch client injecting bearer token + TanStack query/mutation hooks),
`src/store/` (Zustand), `src/components/` (shared UI), `src/features/` per domain, `src/pages/`,
`src/lib/` (i18n strings de.ts, qr, geolocation helpers).

**Participant flow (mobile-first):**
1. `/r/:code` landing — fetch rallye, **immediately persist rallye id to localStorage**; PWA install
   prompt (capture `beforeinstallprompt`, show "Jetzt installieren" button on supported browsers).
2. Username screen → join (token saved to localStorage).
3. Team screen (if `teams_enabled`): join existing or create team (respects size/preset limits).
4. Task overview (station list w/ status badges) → task detail per type:
   - auto types → instant feedback after submit, then locked.
   - free-text/photo → "wird geprüft" pending state until admin evaluates.
   - on-site types → show **QR code** (participant token) for admin to scan; points appear after scan.
5. Leaderboard (polled). Session persists until participant explicitly leaves the rallye.

**Admin flow (desktop + mobile):**
- Login → dashboard (rallye list, create/edit, status control, copy join link + show QR).
- Rallye editor → task builder with per-type config forms and `max_points`.
- **Evaluation queue** — pending free-text/photo answers, mark correct/incorrect + points.
- **On-site scanner** — pick a task, open camera scanner, scan team QR, enter time/points, submit.
- Participant management (re-issue login link), admin account management.

---

## Part 4 — Deployment glue & docs

- `public/.htaccess`: serve existing static files directly; rewrite `/api/*` → CI4 `index.php`;
  fall back all other non-file routes → `/index.html` (SPA deep-link support).
- Confirm `frontend/` stays in `.deployignore` (already present); built assets in `public/` ARE deployed.
- `docs/DOCUMENTATION.md`: feature overview, task-type reference, scoring rules, setup steps (run
  `sql/schema.sql` + `sql/seed_trier.sql` in phpMyAdmin, `.env` DB config, `cd frontend && npm i &&
  npm run build`, sample admin credentials, dev workflow with the Vite proxy).

---

## Verification

1. **DB:** import `schema.sql` + `seed_trier.sql` into `db_team15` via phpMyAdmin — confirm Trier
   rallye + 8 stations + sample admin exist.
2. **API:** `php spark serve`; smoke-test with curl/REST client — admin login returns token; join
   returns participant token; submit auto-graded answer returns instant points; leaderboard endpoint
   sums correctly; on-site submit by token updates rank points.
3. **Frontend:** `cd frontend && npm run dev`; in browser walk the full participant journey (scan/open
   join link → username → team → solve one of each task type → leaderboard) and the admin journey
   (login → build a task → evaluate a pending answer → scan a team QR for an on-site task). Verify
   mobile viewport for participant and desktop for admin, and PWA install prompt appears.
4. **Prod build:** `npm run build` → confirm `public/` gets `index.html` + `assets/` without clobbering
   `index.php`; load via CI4 server and confirm SPA + `/api` both work same-origin.
5. Run `composer test` (PHPUnit) for any backend unit tests added around `GradingService`/`ScoringService`.

## Suggested build order (milestones)
1. SQL schema + Trier seed. 2. CI4 config/auth/models. 3. Core API (rallye/task/team/join/submit).
4. Grading + scoring + leaderboard + on-site + evaluation. 5. Frontend scaffold + participant flow.
6. Admin flow + scanner + evaluation UI. 7. PWA + polish + docs + prod build wiring.