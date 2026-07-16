# FlightMeet – Design-System (verbindliche Referenz)

> Extrahiert aus dem Claude-Design-Entwurf (`v1.0`). **Visuelle Quelle:**
> [`design/FlightMeet-Design-System.dc.html`](design/FlightMeet-Design-System.dc.html) (Tokens & Komponenten),
> [`design/FlightMeet-App.dc.html`](design/FlightMeet-App.dc.html) (Prototyp), Screenshots in
> [`design/screens/`](design/screens/). Diese Datei ist die **Token-Wahrheit** für M0 (DaisyUI-Theme) und
> macht `05-frontend.md` „Branding" konkret. Richtung (ADR-Interview): abenteuerlich-sportlich · Himmelblau
> + Sonnenuntergang-Akzent · großzügig/mobile-first · Komoot/Strava.

## 1. Marke

- **Wortmarke:** „Flight**Meet**" in **Outfit 800**, eng (`letter-spacing ~-0.02em`). „Flight" in
  `text-strong`, „Meet" in **Sky-500** (`#1E90E6`) — im Dark-Mode „Meet" in **Sky-300** (`#5BB8F5`).
- **Wing-Icon:** Gleitschirm-Canopy (weiße Bogenform) + **Coral-Sonne** (`#FF6B4A`), auf einem Sky-Verlauf-
  Quadrat (`linear-gradient(150deg,#5BB8F5,#1E90E6 55%,#0F6FBE)`, `border-radius 10–11px`).
- **Claim (gewählt):** „Finde deine nächste Thermik – gemeinsam fliegen."

## 2. Farben

### 2.1 Markenpaletten (Ramps 50→900)

**Sky — Primär** (`primary = #1E90E6`): `50 #EAF4FE` · `100 #D2E7FC` · `200 #A9D2F8` · `300 #7FBCF5` ·
`400 #4EA2F0` · **`500 #1E90E6`** · `600 #0F6FBE` · `700 #0C5896` · `800 #0B4576` · `900 #0B3357`

**Coral — Akzent** (`accent = #FF6B4A`, Solid-Fill `#F1572F` für weißen Text/AA-large): `50 #FFF2EE` ·
`100 #FFE1D8` · `200 #FFC4B4` · `300 #FF9F88` · `400 #FF8062` · **`500 #FF6B4A`** · `600 #F1572F` ·
`700 #C7421F` · `800 #9E3417` · `900 #7A2810`

**Petrol — Sekundär** (`secondary = #117D87`): `50 #E8F3F4` · `100 #CDE7E9` · `200 #9CCED2` · `300 #66B0B6` ·
`400 #2E8E96` · **`500 #117D87`** · `600 #0C636C` · `700 #0A4F57` · `800 #083E45` · `900 #062E33`

### 2.2 Neutrale Flächen

| Rolle | Light | Dark |
|---|---|---|
| `base / bg` | `#F6F9FC` | `#0B1220` |
| `surface` | `#EEF3F9` | `#0E1726` |
| `card / base-100` | `#FFFFFF` | `#16243A` |
| `border` | `#E2EAF2` | `#243449` |
| `text-strong` | `#0E1726` | `#F2F6FC` |
| `text-muted` | `#5B6B7E` | `#93A4B8` |

(Weitere Grautöne im Einsatz: `#94A3B5` sehr-muted/Icons, `#2A3849` text-default, `#E6EDF5`/`#CFDAE6` helle Borders, `#31435C` Dark-Border-hell.)

### 2.3 Semantik (Light-Tint-bg / Text / 500 / Dark-Variante)

| Status | 500 | Light-Tint bg | Light-Text | Dark |
|---|---|---|---|---|
| **Erfolg** (success) | `#1E9E5A` | `#E4F6EC` | `#157A43` | `#34C77B` |
| **Warnung** (warning) | `#E8A21A` | `#FBF0D6` | `#8A5D00` | `#F5B53D` |
| **Fehler** (error) | `#E5484D` | `#FCE6E7` | `#B42318` | `#FF6066` |
| **Info** | `#1E90E6` | `#E5F1FD` | `#0C5896` | `#5BB8F5` |

**Status-Mapping Flugtreffen:** `Offen→Erfolg` · `Ausgebucht→Warnung` · `Abgesagt→Fehler` · `Beendet→Neutral`.
**Schatten-Grundfarbe:** `rgba(16,40,70,…)` (≈ `#102846`).

## 3. Typografie

- **Headings:** **Outfit** (`400;500;600;700;800`). **Fließtext/UI:** **Inter** (`400;500;600;700`).
- Google Fonts: `family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700`.

| Token | Spezifikation |
|---|---|
| Display | Outfit 800 / 52–56 / 1.0 / `-0.03em` |
| H1 | Outfit 700 / 32 / 1.1 / `-0.02em` |
| H2 | Outfit 700 / 26 / 1.15 / `-0.01em` |
| H3 | Outfit 600 / 21 / 1.2 |
| Body L | Inter 400 / 17 / 1.55 |
| Body M | Inter 400 / 15 / 1.5 |
| Body S | Inter 400 / 13 / 1.5 |
| Label / Caption | Inter 600 / 12 · uppercase · `letter-spacing ~+0.08em` |

## 4. Radius · Schatten · Abstände

- **Radius:** `badge 8` · `input 14` · `image 20` · `card 24` · `sheet 28` · `pill 9999`.
- **Schatten** (Grundfarbe `rgba(16,40,70,a)`):
  - `sm` = `0 1px 2px /.06, 0 1px 3px /.08`
  - `md` (Card) = `0 4px 16px /.06, 0 2px 6px /.04`
  - `lg` (Hover) = `0 12px 32px /.10, 0 4px 12px /.06`
  - `xl` (Popover) = `0 20px 48px /.16, 0 6px 16px /.08`
- **Abstände:** 4px-Basis — `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`.

## 5. Komponenten-Inventar (Kurzspez; Pixel-Referenz in den HTML/Screens)

- **Buttons:** **Pille** (`radius 9999`), Mindesthöhe **44px**. Varianten: **Primär** (Sky-500-Fill, weißer
  Text, Shadow `0 8px 18px rgba(30,144,230,.3)`; Hover `#0F6FBE`, Active `#0C5896` inset, Disabled `#D2E7FC`/
  `#7FBCF5`) · **Akzent** (Solid `#F1572F`) · **Sekundär/Outline** (weiß, `1.5px #CFDAE6`, Text `#0F6FBE`) ·
  **Ghost** (transparent, Text `#0F6FBE`) · **Petrol**. Größen: L (48px, 16px), M (14px), S (13px).
  **Icon-Button** 44px rund; **FAB** 52px Coral.
- **Inputs:** `radius 14`, `1.5px #CFDAE6`-Border; **Fokus** `border #1E90E6` + Ring `0 0 0 4px rgba(30,144,230,.16)`.
  Toggle/Checkbox/Radio in Sky-500. **Segmented Control** (Cards/Karte/Tabelle) als Pille, aktiv = weiße
  Pille + Shadow auf `#EEF3F9`-Track.
- **Badges/Chips** (Pille, `Inter 600/13`, Dot-Indikator):
  - *Erfahrungslevel:* Anfänger=Erfolg-Tint · Fortgeschritten=Info-Tint · Experte=Coral-Tint · Alle Level=Petrol-Tint.
  - *Status:* via Status-Mapping (§2.3). *Region:* weiß + Petrol-Border + Pin. *Tags:* `#hash`, Neutral-Tint.
  - *Zähler:* roter Notification-Dot/Badge; *Chat-Badge* Coral; *„NEU"* Sky; *„Ersteller"* Coral-Tint, uppercase.
- **Cards — Flugtreffen-Card** (`radius 24`, Shadow `lg`): Header `152px` mit **Himmel-Verlauf**
  (`#4FA8EE→#86C9F4→#C7E6FA`) + Sonnen-Glow + **Horizont-Silhouette** + kleinem Gleitschirm; Status-Badge
  oben rechts, Spot-Badge unten links; Body: Erfahrungs- + Datum-Chip, Titel `Outfit 700/19`, Ort, Teilnehmer-Avatare.
- **Profilkarte (Hovercard):** schwebend, Shadow `xl`, runde Avatare, Buttons „Profil ansehen"/„Direktchat öffnen".
- **Navigation:**
  - *Mobile Bottom-Nav* (`radius 24`, oben-Schatten): Home · Flugtreffen · Gruppen · Chat; **aktiv = Sky**
    (gefüllter Strich + Label `#0F6FBE`), Tap-Ziel ≥ 60px, Chat mit Coral-Ungelesen-Badge.
  - *Desktop Top-Bar* / *Slim Sidebar* (`200px`): aktiver Punkt = `#EAF4FE`-Pille + Text `#0F6FBE`. Logo links,
    Suche + Glocke + Avatar rechts.
  - *Mobile Top-App-Bar:* Logo + Suche + Avatar; Profil-Zugang über Avatar oben rechts.
- **Chat** (Track `#F6F9FC`, `radius 18`):
  - *Eingehend:* weiße Bubble (`1px #E6EDF5`), Tail `radius 18 18 18 6`, Name darüber.
  - *Eigene:* Sky-500-Bubble, weißer Text, `radius 18 18 6 18`, „Gelesen"-Status.
  - *Ersteller-Hervorhebung:* Coral-Tint-Bubble (`#FFF2EE`, `1px #FFD3C5`, **`border-left:3px #FF6B4A`**),
    Name in `#C7421F` + **„Ersteller"-Badge**, Avatar mit Coral-Ring.
  - *Reaktionen:* weiße Pillen (Emoji + Count). *Reply:* Zitat mit linkem Border in der Bubble.
  - *Eingabe:* Pille-Input + runder Sky-Senden-Button (46px).
- **Karte (Leaflet/OSM):** Marker als Pin in Sky/Coral; Wasser in Petrol-Ton; Cluster.

## 6. DaisyUI-Theme-Mapping (für M0)

Zwei Custom-Themes **`flightmeet`** (Light, default) + **`flightmeet-dark`**. DaisyUI-v5-Variablen (CSS,
Tailwind v4 `@plugin "daisyui/theme"`):

| DaisyUI-Variable | flightmeet (Light) | flightmeet-dark |
|---|---|---|
| `--color-primary` | `#1E90E6` | `#1E90E6` |
| `--color-primary-content` | `#FFFFFF` | `#FFFFFF` |
| `--color-secondary` | `#117D87` | `#2E8E96` |
| `--color-secondary-content` | `#FFFFFF` | `#04211f` |
| `--color-accent` | `#FF6B4A` (Fill `#F1572F`) | `#FF8062` |
| `--color-accent-content` | `#FFFFFF` | `#3a1108` |
| `--color-neutral` | `#0E1726` | `#16243A` |
| `--color-base-100` | `#FFFFFF` | `#16243A` |
| `--color-base-200` | `#EEF3F9` | `#0E1726` |
| `--color-base-300` | `#E2EAF2` | `#0B1220` |
| `--color-base-content` | `#0E1726` | `#F2F6FC` |
| `--color-info` | `#1E90E6` | `#5BB8F5` |
| `--color-success` | `#1E9E5A` | `#34C77B` |
| `--color-warning` | `#E8A21A` | `#F5B53D` |
| `--color-error` | `#E5484D` | `#FF6066` |
| `--radius-selector` | `9999px` (Pille) | `9999px` |
| `--radius-field` | `14px` (Inputs/Buttons) | `14px` |
| `--radius-box` | `24px` (Cards) | `24px` |

Tailwind-`theme.extend`: `fontFamily.sans = Inter`, `fontFamily.display = Outfit`; Brand-Ramps `sky`/`coral`/
`petrol` (50–900, §2.1) als Farb-Utilities; `boxShadow.card/hover/popover` (§4); `borderRadius` (§4).
Border-Default = `base-300`. Text-muted via `text-base-content/70` bzw. eigenes `--color-muted #5B6B7E`/`#93A4B8`.

> **✅ Umgesetzt (Theme-Fundament):** DaisyUI-Themes `flightmeet` (Light, default) + `flightmeet-dark`,
> Brand-Ramps (Sky/Coral/Petrol), Schatten und Fonts (Outfit/Inter) sind in `frontend/src/index.css`
> (Tailwind v4 + DaisyUI v5) eingebaut; `frontend/index.html` lädt die Fonts und setzt `data-theme`.
> Verifiziert als Styleguide in `frontend/src/App.jsx` (Light & Dark, Build grün).
>
> **Offen für M0:** echte Komponentenbibliothek (`Button`/`Card`/`Badge`/`Input`/`Avatar`/`AppShell`/
> `Bubble`) gegen die Pixel-Referenz, eigene `/styleguide`-Route, TypeScript-Umstellung, Aufräumen der
> Starter-Reste (`App.css`, `src/assets/*`). Hinweis: tint-basierte Highlights (Ersteller-Bubble) müssen
> theme-adaptiv sein (`bg-coral-500/10` statt fixem `coral-50`), sonst im Dark-Mode unlesbar.
