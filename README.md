# FlightMeet 🪂

Community-Plattform für Gleitschirmflieger: **Flugtreffen** an kuratierten Startplätzen finden und
organisieren, sich in **Gruppen** austauschen (Feed + Channels), app-weiter **Chat**, **Profile** und
In-App-**Benachrichtigungen** — dazu Wetter-Prognose (Open-Meteo) und ein KI-Flug-Briefing (Gemini)
direkt am Treffen sowie ein Admin-Dashboard.

Uni-Projekt (Modul *fwe*, Universität Trier), live auf https://team15.wi1cm.uni-trier.de/public/.

> **Aktiver Branch ist `flightmeet-react`** — `main` enthält ein älteres, unabhängiges Schwesterprojekt.

## Stack

| Schicht | Technologie |
|---|---|
| Backend | PHP 8.2+, CodeIgniter 4.7, CodeIgniter Shield (Session-Auth), MySQL 8 |
| Frontend | React 19 + TypeScript, Vite 8, Tailwind v4 + DaisyUI v5, TanStack Query, Zustand, React Router, Zod, Leaflet, Motion |
| Realtime | bewusst **Polling + ETag/304** statt WebSockets (Shared-Webspace-Deploy, ADR-001/002) |
| Tests | PHPUnit (325 Feature-/Unit-Tests, MySQL-Test-DB) · Vitest (52 Smoke-Tests) |

## Lokale Entwicklung

Voraussetzungen: PHP ≥ 8.2, Composer, Node, MAMP-MySQL auf `127.0.0.1:8889` (DB `db_team15`, root/root).
`.env` aus der Vorlage `env` erstellen.

```bash
composer install
php spark migrate --all               # Schema (Shield → Settings → App)
php spark db:seed DatabaseSeeder      # deterministische Demo-Daten
php spark serve --port 8080           # API + /media

cd frontend && npm install
npm run dev                           # http://localhost:5180 (proxied /api → :8080)
```

Demo-Logins: `lena@flightmeet.test` / `passwort123` (Pilotin) und
`admin@flightmeet.test` / `FlightMeet!2026` (Admin, `/admin`).
Für das KI-Briefing optional `gemini.apiKey` in die `.env` legen (sonst antwortet der Endpunkt
`not_configured` und die UI zeigt einen stillen Fallback).

## Tests

```bash
composer test                         # PHPUnit (nutzt Test-DB db_team15_test)
cd frontend && npm run typecheck && npm run lint && npm run test
```

## Dokumentation

Die vollständige Spezifikation liegt in [`spec/`](spec/) — Einstieg über
[`spec/TARGET_SPEC.md`](spec/TARGET_SPEC.md), die verbindlichen Architektur-Entscheidungen in
[`spec/DECISIONS.md`](spec/DECISIONS.md) (ADR-001…019), der API-Katalog in
[`spec/API.md`](spec/API.md). Arbeitskonventionen und Betriebswissen: [`CLAUDE.md`](CLAUDE.md).

## Deploy

Shared Uni-Webspace, nur SFTP (ADR-002): `composer build:frontend` → `composer deploy:remote`;
Schema/Seed als SQL-Dump via phpMyAdmin. Runbook: `spec/06-backend-deployment.md` §13.
