# City-Rallye — Dokumentation

Anwendung zum Durchführen von Stadt-Rallyes für den Fachschaftsrat Informatik der
Universität Trier. Teams besuchen Stationen in der Stadt und lösen ortsbezogene Aufgaben;
Admins richten Rallyes ein, teilen einen Beitritts-Link/QR-Code, bewerten Antworten und
tragen Vor-Ort-Ergebnisse ein. Ein Live-Leaderboard zeigt den Spielstand.

## Architektur

| Teil       | Technologie                                              |
|------------|----------------------------------------------------------|
| Frontend   | Vite + React + TypeScript, Tailwind CSS, Zustand, TanStack Query, React Router, PWA |
| Backend    | PHP 8.2+ / CodeIgniter 4 (REST-API unter `/api`)         |
| Datenbank  | MySQL (`db_team15`)                                      |

Das Frontend wird nach `./public` gebaut und vom CodeIgniter-Projekt mit ausgeliefert
(gleicher Origin). Im Entwicklungsmodus läuft der Vite-Dev-Server und leitet `/api` an
CodeIgniter weiter (`server.proxy`), sodass kein CORS nötig ist.

```
/ (CodeIgniter-Root)
├── app/        REST-API (Controller, Models, Services, Filter)
├── public/     CodeIgniter-Front-Controller + gebaute SPA (Deploy-Ziel)
├── frontend/   React-Quellcode (per .deployignore vom Deploy ausgeschlossen)
├── sql/        schema.sql + seed_trier.sql (über phpMyAdmin ausführen)
└── docs/       Diese Dokumentation
```

## Funktionsumfang

### Admin
- Anmeldung mit Benutzername/Passwort (Bearer-Token-Authentifizierung).
- Rallyes anlegen, bearbeiten, löschen; Status steuern (Entwurf → Aktiv → Beendet).
- Beitritts-Link & QR-Code anzeigen/kopieren.
- Teams konfigurieren: an/aus, max. Teamgröße, feste Teamanzahl.
- Stationen/Aufgaben aller Typen anlegen (mit typspezifischen Einstellungen & Punkten).
- **Bewertungs-Warteschlange**: offene Freitext-/Foto-Abgaben akzeptieren (mit Punkten) oder ablehnen.
- **On-Site-Scanner**: Team-QR-Code scannen und Zeit/Punkte vor Ort eintragen.
- Teilnehmer verwalten und Login-Links (Sitzungs-Wiederherstellung) ausstellen.
- Weitere Admin-Konten anlegen/löschen.

### Teilnehmer (mobil, installierbar als PWA)
- Beitritt über QR-Code/Link → Namenseingabe → ggf. Teamauswahl/-gründung.
- Stationsübersicht mit Status & Punkten, Detailseite je Aufgabe.
- Sofort-Feedback bei automatisch bewerteten Aufgaben; Antworten sind nach Abgabe unveränderlich.
- QR-Code zum Vorzeigen bei Vor-Ort-Aufgaben.
- Live-Leaderboard (Polling).
- Sitzung bleibt im `localStorage` erhalten, bis die Rallye ausdrücklich verlassen wird.

## Aufgabentypen & Bewertung

Jede Aufgabe hat **maximale Punkte** (`max_points`). Bewertung pro Typ:

| Typ                | Bewertung |
|--------------------|-----------|
| `multiple_choice`  | Automatisch. Richtig = max. Punkte, falsch = 0. Sofort-Feedback. |
| `exact_text`       | Automatisch (normalisierter Vergleich). Richtig = max, sonst 0. |
| `numeric_estimate` | Rangbasiert: kleinste Abweichung zum Zielwert = max, linear bis 0. |
| `free_text`        | Trifft eine Musterlösung → automatisch richtig; sonst manuelle Bewertung durch Admin. |
| `photo_upload`     | Foto-Upload, immer manuelle Bewertung. |
| `gps_checkin`      | Automatisch: Standort innerhalb des Radius (Haversine) → max Punkte. |
| `onsite_time`      | Aufsicht trägt Zeit (Sek.) per QR-Scan ein. Rangbasiert: schnellste = max, langsamste = 0. |
| `onsite_points`    | Aufsicht trägt Rohpunkte per QR-Scan ein (auf max gedeckelt). |

**Leaderboard**: Summe aller Punkte je Team. Deterministische/manuell bewertete Punkte werden
gespeichert; rangbasierte Typen (`numeric_estimate`, `onsite_time`) werden beim Lesen über alle
Teams neu berechnet, damit die Stände korrekt bleiben, sobald neue Abgaben eintreffen.
Rang-Formel: `Punkte = round(max_points * (n-1-bessere) / (n-1))`, wobei `n` = Anzahl Teams mit Abgabe.

Bei deaktivierten Teams erhält jeder Teilnehmer intern ein unsichtbares 1-Personen-Team.

## Einrichtung

### 1. Datenbank
In phpMyAdmin auf `db_team15` ausführen:
1. `sql/schema.sql` (legt alle Tabellen an).
2. `sql/seed_trier.sql` (Beispiel-Rallye „Trier Entdecker-Rallye").

Beispiel-Admin: **`admin`** / **`rallye2026`** · Beitritts-Code: **`trier`** (Link `/r/trier`).

### 2. Backend
DB-Zugangsdaten in `.env` setzen (Beispiel für MAMP liegt bereits vor). Auf dem Uni-Webspace
eine eigene `.env` anlegen (wird nicht mitdeployt) oder die Werte in
`app/Config/Database.php` anpassen.

Lokaler Dev-Server: `php spark serve` (Port 8080).

### 3. Frontend
```bash
cd frontend
npm install
npm run dev      # Entwicklung (Port 5173, /api wird an :8080 weitergeleitet)
npm run build    # Produktion: baut nach ../public (index.php bleibt erhalten)
```

### 4. Deployment
- `composer deploy:local` → MAMP (`/Applications/MAMP/htdocs/fwe/`)
- `composer deploy:remote` → Uni-Webspace (lftp)

Vor dem Deploy `npm run build` ausführen, damit die aktuelle SPA in `public/` liegt.
`public/.htaccess` leitet `/api` und `/media` an CodeIgniter, liefert statische Dateien direkt
aus und gibt alle übrigen Routen an die SPA (`index.html`) — so funktionieren tiefe Links.

## API-Überblick (Auszug)

Authentifizierung: `Authorization: Bearer <token>` (Admin- bzw. Teilnehmer-Token).

| Methode | Pfad | Auth | Zweck |
|---------|------|------|-------|
| POST | `/api/admin/login` | – | Admin-Login → Token |
| GET  | `/api/rallyes/{code}` | – | Öffentliche Beitritts-Info |
| POST | `/api/rallyes/{code}/join` | – | Teilnehmer anlegen → Token |
| GET  | `/api/me` | Teilnehmer | Eigener Kontext (Rallye, Team) |
| GET  | `/api/rallyes/{id}/tasks` | Teilnehmer | Aufgabenliste (ohne Lösungen) |
| POST | `/api/teams`, `/api/teams/{id}/join` | Teilnehmer | Team gründen/beitreten |
| POST | `/api/tasks/{id}/submit` · `/photo` | Teilnehmer | Antwort/Foto abgeben |
| GET  | `/api/rallyes/{id}/leaderboard` | Teilnehmer | Leaderboard (gepollt) |
| GET/POST/PUT/DELETE | `/api/admin/rallyes…`, `…/tasks…` | Admin | Verwaltung |
| GET  | `/api/admin/rallyes/{id}/pending` | Admin | Bewertungs-Warteschlange |
| POST | `/api/admin/submissions/{id}/evaluate` | Admin | Manuelle Bewertung |
| POST | `/api/admin/submissions/onsite` | Admin | Vor-Ort-Eintrag per Team-Token |
| POST | `/api/admin/participants/{id}/reissue` | Admin | Neuen Login-Link ausstellen |

## Hinweise
- Die PWA nutzt SVG-Icons. Für optimale Installierbarkeit auf allen Plattformen können bei Bedarf
  zusätzliche PNG-Icons (192/512 px) ergänzt werden (`frontend/vite.config.ts`, `manifest.icons`).
- Foto-Uploads liegen in `writable/uploads/` und werden über `/media/photos/{datei}` ausgeliefert
  (zufälliger Dateiname als Zugriffsschutz).
- GPS-Check-in und Kamera-Scanner benötigen HTTPS (außer auf `localhost`).
