# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

City-Rallye: an app for running city rallyes for the FSR Informatik (Uni Trier). Teams visit
stations and solve location-based tasks; admins set up rallyes, share a join link/QR, evaluate
answers and enter on-site results; a live leaderboard tracks scores. All user-facing strings are
**German**.

Stack: CodeIgniter 4 REST API (PHP 8.2+) + React/Vite SPA + MySQL (`db_team15`). The SPA is built
into `public/` and served same-origin by CodeIgniter. See `docs/DOCUMENTATION.md` for the feature/
API/task-type reference.

## Commands

Backend (run from repo root):
- `php spark serve --port 8080` — dev API server.
- `php spark routes` — list routes / quickest way to catch a PHP boot or class-signature error.
- `composer test` — PHPUnit. Single test: `vendor/bin/phpunit --filter testName path/to/Test.php`.
- `composer deploy:local` (rsync → MAMP) · `composer deploy:remote` (lftp → uni webspace). Both
  honor `.deployignore` (which excludes `frontend/` and `.env`).

Frontend (run from `frontend/`):
- `npm run dev` — Vite dev server on :5173. `vite.config.ts` proxies `/api` and `/media` → :8080,
  so run `php spark serve` alongside it.
- `npm run build` — tsc typecheck + Vite build **into `../public`** (`emptyOutDir: false`, so CI4's
  `index.php` and `.htaccess` are preserved). Run before deploying.
- `npm run lint`.

Database: MySQL is hand-managed (no CI4 migrations on prod). Apply `sql/schema.sql` then
`sql/seed_trier.sql` via phpMyAdmin against `db_team15`. `schema.sql` drops & recreates all tables.
Sample admin: `admin` / `rallye2026`; sample join code: `trier`.

## Base-path / deployment gotcha

Production is served under a subpath: `https://team15.wi1cm.uni-trier.de/public/`. Therefore:
- `vite.config.ts` sets `base = '/public/'` for `build`, `'/'` for dev.
- Frontend code MUST build URLs with `import.meta.env.BASE_URL` — never hardcode a leading `/`.
  The fetch client (`frontend/src/api/client.ts`) uses `` `${import.meta.env.BASE_URL}api${path}` ``;
  the router uses `basename={import.meta.env.BASE_URL}`; asset/QR/link URLs (`/r/`, `/s/`, icons)
  all go through `BASE_URL`. Adding a new fetch call or absolute link means using `BASE_URL` too.
- `public/.htaccess` routes `^(api|media)` to CI4's `index.php`, serves existing files directly, and
  falls back all other routes to `index.html` (SPA deep links).

## Backend architecture (`app/`)

- **Auth is stateless bearer tokens for both roles.** Two filters in `app/Filters/`
  (`AdminAuthFilter`, `ParticipantAuthFilter`, aliased in `Config/Filters.php`) validate the
  `Authorization: Bearer` header and populate the request-scoped `App\Libraries\AuthState` shared
  service. Controllers read the current identity via `service('authState')`. Admin tokens live in
  `admin_tokens`; a participant's token IS their identity (the `participants.token` column,
  re-issuable by an admin for session recovery).
- **Routes** (`Config/Routes.php`) are all under `group('api')`, split into public, `participantAuth`,
  and `admin`/`adminAuth` groups. Admin controllers live in `App\Controllers\Api\Admin\`.
- **Controllers** extend `App\Controllers\Api\ApiController` (uses `ResponseTrait`, not
  `ResourceController` — the latter's fixed method signatures conflict with our `id`-param actions).
  Helpers: `body()`, `currentParticipant()`, `currentAdmin()`.
- **Two domain services hold the scoring logic** (registered in `Config/Services.php`):
  - `GradingService::grade()` — bewertet a submission *at submit time* for deterministic types
    (multiple_choice, exact_text normalized-compare, gps_checkin haversine, free_text sample-match);
    persists `status` + `awarded_points`. Rank-based and admin-decided types are left pending/null.
  - `ScoringService` — computes leaderboard & per-team breakdown **on read**: sums persisted
    `awarded_points` and *recomputes* rank-based types (numeric_estimate, onsite_time) across all
    teams so totals stay correct as new submissions arrive. This is why rank-based submissions store
    `awarded_points = NULL` and a `raw_value` instead.
- **Task config is a JSON column** on `tasks` (per-type settings: choices/correct_index, accepted,
  target, sample_solutions, lat/lng/radius_m). Decode with `TaskModel::decodeConfig()`. Type
  constants (`TYPES`, `AUTO_TYPES`, `RANK_TYPES`, `ONSITE_TYPES`) live on `TaskModel`.
- One submission per `(task_id, team_id)` (unique key); participant submissions are immutable, but
  the on-site endpoint upserts (admin can overwrite). When teams are disabled, each participant gets
  an invisible solo team (`teams.is_solo`).
- Photo uploads go to `writable/uploads/` and are served by `App\Controllers\Media` via
  `/media/photos/{file}` — the random filename is the access capability (no auth header, since
  `<img>` tags can't send one).

## Frontend architecture (`frontend/src/`)

- `api/client.ts` — single fetch wrapper (`api<T>()`), injects bearer token, throws `ApiError` with
  the German server message. `api/participant.ts` and `api/admin.ts` are the TanStack Query
  hook layers; tokens are pulled from the Zustand stores via `getState()`.
- State: Zustand stores persisted to localStorage — `store/session.ts` (participant token + active
  rallye; `leave()` clears it) and `store/adminAuth.ts` (admin token). Remote state + polling is
  TanStack Query (leaderboard/tasks/pending refetch on intervals).
- Routing (`App.tsx`): `/r/:code` join, `/s/:token` session-restore, `/rallye/*` participant area
  (guarded by participant token, with a team-gate that forces team selection), `/admin/*` admin area
  (guarded by admin token). No-body POSTs must pass `method: 'POST'` explicitly (the client defaults
  to GET when there's no body). After join/create-team, the `me` cache is optimistically updated to
  avoid the team-gate bouncing the user back.
- UI primitives in `components/ui.tsx`; task-type labels/hints in `lib/taskTypes.ts`; geolocation in
  `lib/geo.ts`; PWA install prompt in `lib/install.ts`. QR generation via `qrcode.react`, camera
  scanning via `@yudiel/react-qr-scanner`. PWA configured in `vite.config.ts` (vite-plugin-pwa).
