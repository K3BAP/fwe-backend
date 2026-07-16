# Frontend-Architektur & UX

Dieses Kapitel spezifiziert die React-19/Vite-8-SPA in `frontend/` (gebaut nach `public/`, same-origin zur CI4-API). Es ist verbindlich an die ADRs gebunden. **Wichtige Vorab-Korrektur gegenüber dem ursprünglichen Frontend-Dossier:** Frühere Notizen erwähnen Bearer-Token im `AuthStore` und einen `RealtimeStore`/Supabase-Channel. Beides ist durch die ADRs **überholt**: Auth läuft per **HttpOnly-Session-Cookie (Shield, ADR-004)** — es gibt **kein** JS-lesbares Token, der `AuthStore` hält nur den abgeleiteten Session-Zustand. Realtime ist **Polling (ADR-001)** — es gibt **keinen** `RealtimeStore` und keinen Supabase-Client. Alle nachfolgenden Festlegungen reflektieren diesen korrigierten Stand.

---

## 1. TypeScript-Setup (ADR-003)

Vollständige Umstellung auf TypeScript. `App.jsx`/`main.jsx` → `.tsx`, `vite.config.js` → `vite.config.ts`, ESLint auf `typescript-eslint`.

### 1.1 tsconfig (strikt, Vite-Project-References-Layout)

Vite 8 nutzt das geteilte Setup `tsconfig.json` (Solution-File) + `tsconfig.app.json` (Browser-Code) + `tsconfig.node.json` (Vite-Config). Verbindliche Compiler-Optionen für `tsconfig.app.json`:

| Option | Wert | Begründung |
|---|---|---|
| `strict` | `true` | Non-negotiable; aktiviert u.a. `strictNullChecks`. |
| `noUncheckedIndexedAccess` | `true` | `arr[i]` ist `T \| undefined` — fängt Array-/Record-Zugriffe (z.B. `presence[convId]`). |
| `noImplicitOverride`, `noFallthroughCasesInSwitch` | `true` | Sicherheit bei Enums/Discriminated Unions (Chat-`type`, Meetup-Status). |
| `verbatimModuleSyntax` | `true` | Erzwingt `import type` — sauberer Tree-Shake. |
| `moduleResolution` | `"bundler"` | Vite-konform. |
| `jsx` | `"react-jsx"` | Kein `import React` nötig. |
| `paths` | `{ "@/*": ["./src/*"] }` | Absolute Imports; spiegelt in `vite.config.ts` via `resolve.alias` **und** `vite-tsconfig-paths`. |
| `types` | `["vite/client"]` | `import.meta.env`-Typen. |

`src/vite-env.d.ts` typisiert projekteigene Env-Variablen (z.B. `BASE_URL` ist bereits via `vite/client` typisiert; eigene `VITE_*`-Vars über `interface ImportMetaEnv` ergänzen).

### 1.2 typescript-eslint (Flat Config)

`eslint.config.ts` mit `tseslint.config(...)`. Empfohlene Sets: `tseslint.configs.recommendedTypeChecked` + `tseslint.configs.stylisticTypeChecked` (type-aware Linting via `parserOptions.projectService: true`), plus `eslint-plugin-react-hooks` (`recommended`) und `eslint-plugin-react-refresh` (Vite-HMR-Safety). Harte Regeln: `@typescript-eslint/no-floating-promises` (jede Mutation/`mutateAsync` muss awaited/`void`'d sein), `@typescript-eslint/consistent-type-imports`.

### 1.3 Zod als Typ-Single-Source-of-Truth (ADR-003)

Über die untypisierte CI4-JSON-Grenze ist **Zod die alleinige Typquelle**. Pro Feature ein `schemas.ts`:

```ts
// features/flugtreffen/schemas.ts
export const MeetupStatus = z.enum(['open', 'cancelled']);          // DB-persistiert
export const DerivedStatus = z.enum(['open','full','done','cancelled']); // Read-berechnet (ADR-002/Cron-Verbot)
export const ExperienceLevel = z.enum(['beginner','advanced','expert','all']);

export const MeetupSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  spot: SpotSchema,
  status: MeetupStatus,
  derived_status: DerivedStatus,         // serverseitig im Read-Pfad gesetzt
  experience_level: ExperienceLevel,
  starts_at: z.string().datetime({ offset: true }),
  participant_count: z.number().int(),
  capacity: z.number().int().nullable(),
});
export type Meetup = z.infer<typeof MeetupSchema>;   // <- der EINZIGE Meetup-Typ
```

Regeln:
- **Keine handgeschriebenen `interface`/`type` für Server-DTOs oder Formulare** — immer `z.infer`.
- **Form-Schemas** (Input-Seite, z.B. `MeetupCreateInput`) sind getrennt vom **Response-Schema** (Output-Seite). Das Form-Schema speist sowohl RHF-Resolver als auch den Request-Body-Typ.
- API-Antworten werden im API-Client (oder in der `queryFn`) **geparst** (`Schema.parse`), nicht blind gecastet — so wird die CI4-Grenze einmal validiert. In Prod optional `safeParse` mit Logging statt Throw, um die UI nicht an Schema-Drift sterben zu lassen.

---

## 2. Routing

### 2.1 Subpath-sichere SPA auf CI4/Apache (ADR-002)

Die SPA wird nach `public/` gebaut und same-origin ausgeliefert. Router:

```ts
const router = createBrowserRouter(routes, { basename: import.meta.env.BASE_URL });
```

- `import.meta.env.BASE_URL` kommt aus `vite.config.ts` → `base` (z.B. `/` bei Auslieferung unter `public/`, oder `/app/` bei Unterverzeichnis). **Niemals hartkodierte `/`-Pfade** — immer `<Link>`/`<NavLink>`. Assets relativ zu `BASE_URL`.
- **History-Fallback:** Deep-Links (z.B. `/flugtreffen/42` per Reload) müssen Apache auf `index.html` umschreiben, sonst 404. Die bestehende `.htaccess` (Recent-Commit „redirect to /public") wird ergänzt: API-/Media-Pfade gehen an CI4, alles andere an die SPA:

```apache
RewriteEngine On
# API und Medien an CodeIgniter (index.php) durchreichen
RewriteRule ^(api|media)/ - [L]
# vorhandene statische Assets direkt ausliefern
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]
# alles andere -> SPA-Entry
RewriteRule ^ index.html [L]
```

**✅ Entschieden:** API strikt unter `/api/v1` (und Assets unter `/media`); der CI4-Rewrite `^(api|media)` matcht **vor** dem SPA-Catch-all auf `index.html` — die Reihenfolge ist damit eindeutig.

### 2.2 Vollständige Route-Tabelle

Layout-Routes (`<Outlet/>`): `RootLayout` (Shell mit Top-Navbar/Bottom-Nav, Toaster, Notification-Bell), darin `ProtectedLayout` (Auth-Gate). Öffentliche Auth-Seiten liegen außerhalb des `ProtectedLayout`.

| Pfad (rel. zu basename) | Element | Schutz | Layout | Zweck / Query-Key |
|---|---|---|---|---|
| `/` | `HomeDashboard` | geschützt | Root→Protected | Dashboard: kommende Treffen, eigene Gruppen, Ungelesen-Übersicht |
| `/login` | `LoginPage` | öffentlich (Redirect wenn eingeloggt) | Root | Shield-Login |
| `/register` | `RegisterPage` | öffentlich | Root | Registrierung (minimal: Anzeigename, ADR-010) |
| `/flugtreffen` | `MeetupListPage` | geschützt | Protected | `['flugtreffen', filter]` + Kartenübersicht |
| `/flugtreffen/neu` | `MeetupCreatePage` | geschützt | Protected | RHF+Zod, Spot-Autocomplete (ADR-007) |
| `/flugtreffen/:id` | `MeetupDetailPage` | geschützt | Protected | `['flugtreffen', id]` + Teilnahme-Toggle + Treffen-Chat |
| `/gruppen` | `GroupListPage` | geschützt | Protected | `['gruppen', filter]` (visibility-gefiltert serverseitig) |
| `/gruppen/neu` | `GroupCreatePage` | geschützt | Protected | visibility/join_policy (ADR-006) |
| `/gruppen/:id` | `GroupDetailPage` | geschützt | Protected | `['gruppen', id]`, Feed + Channels + Beitritt |
| `/gruppen/:id/einstellungen` | `GroupSettingsPage` | geschützt (BOLA: Owner/Admin) | Protected | Verwaltung, Join-Requests/Invites |
| `/chat` | `ChatLayout` (Index→Empty) | geschützt | Protected | Konversationsliste (Sidebar), `['chat','conversations']` |
| `/chat/:conversationId` | `ConversationView` | geschützt (BOLA: Teilnehmer) | Protected/ChatLayout | `['chat', conversationId, 'messages']`, Polling 2–3 s |
| `/profil/:userId` | `ProfilePage` | geschützt | Protected | `['profil', userId]`, Bio-Markdown (ADR-011) |
| `/profil/me/bearbeiten` | `ProfileEditPage` | geschützt | Protected | Erweitertes Profil (ADR-010), RHF+Zod |
| `/benachrichtigungen` | `NotificationCenterPage` | geschützt | Protected | `['notifications']` (ADR-008) |
| `/einstellungen` | `SettingsPage` | geschützt | Protected | Theme, Account |
| `*` | `NotFoundPage` | — | Root | 404 |

**Treffen bearbeiten hat bewusst keine eigene Route:** `MeetupEditModal` zeigt alle Felder flach auf
einen Blick und öffnet über der Detailseite bzw. direkt in der Admin-Tabelle (ADR-019). Der
mehrstufige Wizard bleibt dem **Erstellen** vorbehalten — beim Bearbeiten steht bereits alles fest,
Schritte würden nur verstecken, was man ändern will.

**ProtectedRoute-Mechanik:** `ProtectedLayout` liest den Bootstrap-Status aus dem `AuthStore` (gespeist aus `useQuery(['me'])`, siehe §3). Solange `['me']` `pending` ist → Full-Page-Skeleton (kein Flash). Bei `401`/null-User → `<Navigate to="/login" replace state={{ from: location }} />`; nach Login Rücksprung auf `state.from`. **Wichtig (BOLA, _crosscutting #4):** Diese Gates sind **nur UX** — die echte Autorisierung pro Objekt (Mitglied/Owner/Teilnehmer) erfolgt serverseitig; das Frontend reagiert lediglich auf `403`/`404`.

**Code-Splitting:** schwere Routen lazy: `MeetupListPage`/`MeetupDetailPage` (Leaflet) und der gesamte `chat`-Branch via `React.lazy` + `<Suspense fallback={<Skeleton/>}>`. Pro Route eine `errorElement`-`ErrorBoundary` (siehe §11).

---

## 3. State-Grenze (verbindliche Leitlinie)

**Eine harte Regel (ADR-001, _crosscutting #2):**

> **Server-Daten leben ausschließlich in TanStack Query. Zustand hält nur Client-/UI-/Session-State. Nichts wird dupliziert.**

| Datentyp | Heimat | Begründung |
|---|---|---|
| Flugtreffen, Gruppen, Profile, Chat-Nachrichten, Notifications, `me` | **TanStack Query** | Remote, cache-/refetch-/invalidations-pflichtig |
| Session-Status (eingeloggt? abgeleiteter User-Snapshot) | **AuthStore** (Zustand, **nicht** persistiert) | Quelle ist `['me']`; Store spiegelt nur, kein Token |
| Theme | **UiStore** (Zustand, **`theme` persistiert** in `localStorage`) | reiner Client-Präferenz-State |
| Offene Modals/Drawer, aktiver Bottom-Tab-Overlay | **UiStore** (nicht persistiert) | UI-Overlays |
| Polling-Steuerung (aktive Konversation, `document.hidden`) | **lokal/Query-Optionen**, kein eigener Store | ADR-001; via `refetchInterval`-Callback |

### 3.1 Stores

**`AuthStore`** (korrigiert — kein Token):
```ts
interface AuthState {
  user: { id: number; anzeigename: string; avatarUrl: string | null } | null;
  status: 'unknown' | 'authenticated' | 'guest';
  istEingeloggt: () => boolean;        // status === 'authenticated'
  setFromMe: (u: AuthState['user']) => void;  // aus useQuery(['me']) gespeist
  clear: () => void;                   // nach Logout / 401
}
```
Das Cookie ist HttpOnly → der Store **kann und soll** kein Token halten. `setFromMe` wird in einem `useEffect`/`onSuccess` am `['me']`-Query gesetzt; `clear()` beim `401`-Interceptor und nach explizitem Logout. `istEingeloggt()` ist nur eine UX-Heuristik.

**`UiStore`** (`theme` persistiert):
```ts
interface UiState {
  theme: 'light' | 'dark' | 'system';
  setTheme: (t: UiState['theme']) => void;
  offeneModals: string[];
  openModal: (id: string) => void;
  closeModal: (id: string) => void;
}
```
`persist`-Middleware mit `partialize: (s) => ({ theme: s.theme })` (nur Theme persistieren). Ein `ThemeProvider` schreibt das effektive Theme als `data-theme` auf `<html>` (siehe §5) und hört bei `'system'` auf `matchMedia('(prefers-color-scheme: dark)')`.

**Kein `RealtimeStore`** (ADR-001 streicht ihn ersatzlos).

### 3.2 Polling statt Realtime-Store (ADR-001)

Realtime = gestaffeltes TanStack-Polling, eingehende Nachrichten via `queryClient.setQueryData` in den Cache gemerged — **kein** paralleler Message-Store:

| Query | `refetchInterval` |
|---|---|
| `['chat', conversationId, 'messages']` (aktive Konversation) | 2–3 s, **pausiert bei `document.hidden`/Blur** |
| `['chat','conversations']`, `['notifications']`, Unread-Aggregat | 15–20 s |
| Listen/Dashboards (`['flugtreffen']`, `['gruppen']`) | 30 s oder `refetchOnWindowFocus` |

`refetchInterval` als Funktion: `(query) => document.hidden ? false : 2500`. Inkrementell via `?since=<message_id>` und `ETag`/`If-None-Match` → `304` (siehe §4). Delta-Antworten werden mit der bestehenden Liste im Cache gemergt (`setQueryData`), nicht ersetzt.

---

## 4. API-Client (ADR-004)

Ein zentraler Wrapper in `shared/api/client.ts`. **Korrigiert gegenüber Alt-Dossier:** keine Bearer-Injection — Auth über Cookie.

### 4.1 fetch-Wrapper

```ts
const BASE = '/api/v1';

export async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',                 // Session-Cookie mitsenden (same-origin)
    headers: {
      'Accept': 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(isMutating(init.method) ? { 'X-CSRF-TOKEN': getCsrfToken() } : {}),
      ...init.headers,
    },
  });

  if (res.status === 304) throw new NotModified();         // Polling-Optimierung
  if (res.status === 401) { authStore.getState().clear(); throw new ApiError(parsed); }
  if (!res.ok) throw new ApiError(await parseEnvelope(res));

  const json = await res.json();
  return schema.parse(json.data ?? json);                  // Zod-Validierung der CI4-Grenze
}
```

- **`credentials: 'include'`** überall (same-origin, ADR-004).
- **CSRF (ADR-004):** CI4 `csrf`-Filter im Header-/Double-Submit-Modus. Das CSRF-Token ist als **nicht-HttpOnly** Cookie lesbar (z.B. `csrf_cookie_name`) und wird bei `POST/PUT/PATCH/DELETE` als `X-CSRF-TOKEN`-Header gespiegelt. Bei `403` mit `error.code = 'csrf_invalid'` einmal Token neu holen und retryen.
- **401-Handling:** zentral → `AuthStore.clear()` + Redirect auf `/login` (über einen Router-fähigen Handler oder Query-`onError`).

### 4.2 Error-Envelope-Handling (_crosscutting #6)

CI4 liefert einheitlich:
```json
{ "error": { "code": "meetup_full", "message": "Dieses Flugtreffen ist bereits ausgebucht." } }
```
`ApiError` trägt `code` (englisch, maschinenlesbar — für Logik/Switch) **und** `message` (deutsch — für Toast/Inline). UI verzweigt **immer über `code`**, zeigt **`message`** an. Validierungsfehler (`422`) mappen auf ein `fieldErrors`-Objekt, das RHF via `setError` einspielt.

### 4.3 Query-Key-Konventionen

Hierarchisch, ein zentrales `queryKeys`-Objekt (Factory) zur Vermeidung von Tippfehlern und für gezielte Invalidierung:

```ts
export const qk = {
  me: ['me'] as const,
  flugtreffen: { all: ['flugtreffen'] as const,
                 list: (f: MeetupFilter) => ['flugtreffen', f] as const,
                 detail: (id: number) => ['flugtreffen', id] as const },
  gruppen: { all: ['gruppen'] as const,
             detail: (id: number) => ['gruppen', id] as const },
  profil: (userId: number) => ['profil', userId] as const,
  chat: { conversations: ['chat','conversations'] as const,
          messages: (cid: number) => ['chat', cid, 'messages'] as const },
  notifications: ['notifications'] as const,
};
```
Regel: Listen-Keys tragen das Filter-Objekt als letztes Element; Mutationen invalidieren den **schmalsten** passenden Prefix (`qk.flugtreffen.all` invalidiert alle Listen+Details).

---

## 5. DaisyUI-Theme & Branding

DaisyUI-Theme in der CSS-`@plugin "daisyui/theme"`-Deklaration (Tailwind 4 / `@tailwindcss/vite`). **Zwei Custom-Themes** im Himmel/Gleitschirm-Stil; Default = System-Präferenz, manueller Toggle (persistiert, §3).

**`flightmeet-light`** (Himmel/Tag): Primär = Himmelblau (`oklch(~0.65 0.14 235)`), Sekundär = warmes Gleitschirm-Orange/Sonnenuntergang, Akzent = Wiesengrün (Startplatz), `base-100` = sehr helles Luftblau-Weiß. **`flightmeet-dark`** (Abend/Nacht am Startplatz, ADR-Begründung Outdoor-Nutzung): dunkles Nachtblau `base-100`, gedämpftes Himmelblau-Primär, Orange-Akzent für Glow.

Mechanik:
- `data-theme` auf `<html>` über `ThemeProvider`; bei `'system'` via `matchMedia` aufgelöst und live aktualisiert.
- Branding-Tokens (Logo-Gradient Himmel→Horizont, Schriftpaar) in `shared/ui/theme`. Gleitschirm-Silhouette als Empty-State-/Loading-Illustration.
- DaisyUI-Komponenten (`btn`, `card`, `badge`, `tabs`, `skeleton`, `drawer`, `modal`) durchgängig; keine Ad-hoc-Farben — nur semantische Tokens (`primary`, `base-200`, `error` …), damit Dark Mode automatisch trägt.

---

## 6. Framer Motion (gezielt, reduced-motion-sicher)

Sparsamer Einsatz, jede Animation mit `useReducedMotion`-Guard; in langen Listen nur leichte Fade/Slide (Mobile-Performance):

| Ort | Animation |
|---|---|
| Route-/Seitenübergänge | `AnimatePresence` Fade/Slide am `<Outlet>`-Wrapper |
| Modals/Drawer/Bottom-Sheet | Scale/Slide-in + Backdrop-Fade |
| Chat-Nachricht (neu eingehend/gesendet) | dezentes Slide-up + Fade der Bubble |
| Bottom-Nav Tab-Wechsel | animierter aktiver-Indikator (`layoutId`) |
| Toasts / Notification-Badge | Pop-/Count-Animation bei Inkrement |
| Teilnahme-/Beitritt-Button | Mikro-Feedback (Scale) beim Optimistic-Toggle |

Keine schweren `layout`-Animationen in Listen-Items. `prefers-reduced-motion` → Transitions auf `duration: 0`/Opacity-only.

---

## 7. Formulare (React Hook Form + Zod)

Durchgängig RHF + `@hookform/resolvers/zod`. Das **Form-Zod-Schema ist Validierung und Typquelle** (`z.infer` für `useForm<…>`), deutsche Fehlermeldungen direkt im Schema (`z.string().min(3, 'Mindestens 3 Zeichen')`).

- Backend-Regeln spiegeln (Längen, Enums) — Client validiert, **Server bleibt Autorität**.
- Server-`422`-`fieldErrors` via `setError(field, …)` in die Form einspielen.
- Wiederverwendbare Feld-Komponenten in `shared/ui/form` (`<TextField>`, `<SelectField>`, `<TextareaField>`) binden an RHF-`Controller`/`register` und rendern DaisyUI-`label`/`input` + Fehlerzustand.
- Submit-Button disabled während `isSubmitting`/`isPending`; Erfolg → Toast + `navigate`/`invalidate`.
- Betroffene Formulare: Login/Register, Meetup anlegen/bearbeiten (inkl. Spot-Autocomplete-Feld), Gruppe anlegen (`visibility`/`join_policy`-Selects, ADR-006), Profil-Edit (ADR-010), Bio-Markdown-Editor (ADR-011, mit Live-Preview).

---

## 8. Toaster

**`sonner`** (moderne API, Promise-Toasts passend zu TanStack-Mutations, barrierearm). Ein `<Toaster richColors position="top-center" />` im `RootLayout`. Nutzung: `toast.success`/`toast.error` aus `onSuccess`/`onError` der Mutations; für längere Aktionen `toast.promise`. Fehlertexte kommen aus `ApiError.message` (deutsch). Kein Eigenbau.

---

## 9. Karten (react-leaflet) & Markdown

### 9.1 react-leaflet (ADR-007)

`react-leaflet` + **OSM-Tiles** (kostenlos, kein Key). Marker aus `spot.lat/lng` (kuratierte `spots`-Tabelle — garantiert valide, kein Geocoding). Übersicht: ein Marker-Cluster; Detailseite: einzelner Marker + Popup mit Spot-Name/Region. **Lazy-geladen** (Leaflet ist groß) via `React.lazy`. Leaflet-CSS einmal global importieren; Default-Marker-Icon-Pfad-Fix in einem `setupLeaflet.ts` kapseln.

### 9.2 react-markdown + Sanitizing (ADR-011)

**Bio** = eingeschränktes Markdown: `react-markdown` + `remark-gfm`, **ohne `rehype-raw`** (kein Roh-HTML) **plus** Tag-/Attribut-Allowlist (`rehype-sanitize` mit restriktivem Schema: nur `strong/em/ul/ol/li/a/h1-h3/p`). Externe Links automatisch `rel="noopener noreferrer" target="_blank"`. Diese Render-Komponente (`<SafeBio>`) wird **überall** verwendet, wo die Bio erscheint — vor allem die global eingebundene **Profilkarte** (ADR-011: Sanitizing ist nicht verhandelbar).
**Chat-Nachrichten** dagegen **Plaintext + Auto-Linkify** (kein Markdown — Performance/Sicherheit, ADR-009/011).

---

## 10. Mobile-First & Navigation

Mobile-First. **Bottom-Tabbar** auf kleinen Viewports mit genau vier Punkten, **Top-Navbar ab `md`**:

| Tab | Label (DE) | Route | Badge |
|---|---|---|---|
| Home | Start | `/` | — |
| Flugtreffen | Flugtreffen | `/flugtreffen` | — |
| Gruppen | Gruppen | `/gruppen` | — |
| Chat | Chat | `/chat` | Ungelesen-Zähler (§12) |

Bottom-Nav als DaisyUI `dock`/`btm-nav`, daumenfreundlich (Outdoor-Mobile-Use-Case). Notification-Bell + Avatar-Menü in der Top-Navbar (ab `md`) bzw. im Home-Header auf Mobile. Aktiver Tab via `NavLink`-`isActive` + animiertem Indikator (§6).

---

## 11. Optimistic Updates & UX-Zustände

### 11.1 Optimistic Updates (gezielt)

Nur für drei Aktionen via `onMutate`/`onError`-Rollback/`onSettled`-Invalidate (_crosscutting #8: Server bleibt mit UNIQUE/Transaktion Autorität — UI rollt bei `409` zurück):

| Aktion | Endpoint | Optimistik | Rollback bei |
|---|---|---|---|
| Teilnahme-Toggle | `POST /flugtreffen/:id/teilnahme` | `participant_count`±1, eigener Status sofort | `409 meetup_full` → Toast „ausgebucht" |
| Gruppen-Beitritt/-Verlassen | `POST /gruppen/:id/mitgliedschaft` | Mitglieds-Status/Count sofort | `403`/`409` |
| Chat-Nachricht senden | `POST /chat/:cid/messages` | Pending-Bubble (Status `sending`) | Fehler → `failed`-Marker + Retry |

Komplexe Create-/Edit-Formulare: normales Mutate + Toast + Invalidate (kein Optimismus).

### 11.2 Loading / Empty / Error / Skeletons

Für **jede** datengetriebene View verbindlich alle vier Zustände:
- **Loading:** DaisyUI `skeleton` in der Form der Zielinhalte (Listen-Cards, Chat-Bubbles, Profilkarte) — kein blanker Spinner.
- **Empty:** eigene Empty-State-Komponente mit Gleitschirm-Illustration + Call-to-Action (z.B. „Noch keine Flugtreffen — erstelle das erste").
- **Error:** Inline-Fehlerkarte mit `ApiError.message` + Retry-Button; zusätzlich `errorElement`-`ErrorBoundary` pro Route für Render-Crashes.
- Polling-Hintergrund-Refetches zeigen **keinen** Full-Skeleton (`isPending` vs. `isFetching` unterscheiden) — höchstens dezenter Lade-Indikator.

---

## 12. Notification-Center & Badge-Zähler (ADR-008)

In-App-Benachrichtigungen sind im Scope (ADR-008), gleicher Polling-Read-Pfad.

- **Badge-Zähler:** schlanker Aggregat-Endpoint (Unread-Counts), gepollt alle 15–20 s (ADR-001). Zwei Zähler: globaler Notification-Count (Bell, Top-Navbar) und Chat-Unread-Count (Bottom-Nav-„Chat"-Badge). Animierter Count bei Inkrement (§6).
- **Notification-Center (`/benachrichtigungen`):** Liste aus `['notifications']`, gruppiert (z.B. „Neue Beitrittsanfrage", „Treffen abgesagt", „Erwähnt in …"), Zeitstempel de-DE. Klick navigiert zur Quelle (Treffen/Gruppe/Chat) und markiert gelesen (`PATCH`, Optimistic auf Count). „Alle als gelesen markieren".
- **`notifications.type`** (fester MVP-Satz, ADR-012/C8): Die UI mappt `type` → deutsches Label + Icon + Ziel-Route in einer zentralen `notificationCopy.ts`-Map, damit neue Typen ohne UI-Refactor ergänzbar sind.

---

## 13. src-Struktur (feature-basiert)

```
frontend/src/
  app/
    router.tsx              # createBrowserRouter, basename=BASE_URL
    providers.tsx           # QueryClientProvider -> RouterProvider
    ThemeProvider.tsx       # data-theme aus UiStore
    layouts/                # RootLayout, ProtectedLayout, ChatLayout
  shared/
    api/                    # client.ts (apiFetch), queryKeys.ts, errors.ts, csrf.ts
    ui/                     # DaisyUI-Primitives, form/, EmptyState, Skeletons, SafeBio, Toaster-Setup
    lib/                    # format-de.ts (Intl), setupLeaflet.ts, useReducedMotion-Wrapper
    components/             # ProtectedRoute, ErrorBoundary, NotificationBell, BottomNav
    stores/                 # authStore.ts, uiStore.ts
  features/
    auth/                   # LoginPage, RegisterPage, schemas.ts, useMe, useLogin/useLogout
    flugtreffen/            # pages, components, hooks (useMeetups…), api.ts, schemas.ts
    gruppen/                # pages, components, hooks, api.ts, schemas.ts
    chat/                   # ConversationView, MessageList, useMessages (Polling), api.ts, schemas.ts
    profil/                 # ProfilePage, ProfileEditPage, ProfileCard, schemas.ts
    benachrichtigungen/     # NotificationCenterPage, useNotifications, schemas.ts
  vite-env.d.ts
```
`features/*` kapseln je Domäne `pages + components + hooks + api + schemas (+ types via z.infer)`. `shared/` und `app/` sind querschnittlich. Chat-/Polling-Logik bleibt in `features/chat` isoliert (Transport-Tausch bliebe lokal — ADR-001-Migrationspfad).

---

## 14. i18n-Ansatz (Deutsch)

**Kein `react-i18next`** (Overhead unnötig für deutschsprachiges Projekt). Nutzersichtbare Strings **hardcoded Deutsch** (Konvention: Labels DE, technische Keys EN). **Aber** zentralisiert:
- Datum/Zeit **ausschließlich** über `Intl.DateTimeFormat('de-DE', …)` in `shared/lib/format-de.ts` (`formatDatum`, `formatUhrzeit`, `formatRelativ`) — nie ad-hoc.
- Enum→Label-Maps (z.B. `experience_level`, `join_policy`, `derived_status`, `notification.type`) zentral je Feature, damit englische Keys konsistent auf deutsche Labels mappen.

**✅ Entschieden (ADR-012/D1):** Einsprachig **Deutsch**; `react-i18next` bewusst **nicht** im Scope. (Wäre Mehrsprachigkeit je Ziel, wäre das der Umstieg.)

---

## 15. Akzeptanzkriterien

1. **TypeScript/Zod:** Build läuft mit `strict: true` ohne `any`-Casts an der API-Grenze; **kein** Server-DTO- oder Form-Typ ist von Hand deklariert — alle stammen aus `z.infer`. `npm run lint` (typescript-eslint, type-checked) ist grün; keine `no-floating-promises`-Verstöße.
2. **Auth (ADR-004):** Es existiert **kein** JS-lesbares Auth-Token; Requests senden `credentials:'include'`; mutierende Requests tragen den CSRF-Header; `401` führt zentral zu `AuthStore.clear()` + Redirect auf `/login` mit Rücksprung.
3. **Routing/Deep-Link:** Reload auf `/flugtreffen/:id` und `/chat/:cid` liefert dank `.htaccess`-Fallback die App (kein 404); `/api/v1/*` und `/media/*` gehen weiter an CI4; alle internen Links nutzen `<Link>`/`<NavLink>` mit `basename=BASE_URL`; unbekannte Pfade → `NotFoundPage`.
4. **State-Grenze:** Keine Server-Entität liegt in einem Zustand-Store; Chat-Deltas werden via `setQueryData` gemergt; nur `theme` ist persistiert.
5. **Realtime=Polling (ADR-001):** Aktive Konversation pollt 2–3 s und **pausiert bei `document.hidden`**; Unread-/Listen-Polling 15–30 s; `?since=`/`ETag`→`304` wird genutzt; **kein** WebSocket/Supabase-Client im Bundle.
6. **BOLA:** Routing-Gates sind reines UX; bei `403`/`404` zeigt die UI sauber Fehler/Redirect; keine Aktion verlässt sich allein auf das clientseitige Gate.
7. **UX-Zustände:** Jede datengetriebene View hat Loading-Skeleton, Empty-State und Error-State + Retry; Hintergrund-Refetch zeigt keinen Full-Skeleton.
8. **Optimistic Updates:** Teilnahme, Gruppen-Beitritt, Chat-Senden aktualisieren sofort und rollen bei `409`/Fehler korrekt zurück (inkl. `meetup_full`).
9. **Formulare:** Alle Formulare nutzen RHF+Zod-Resolver; Server-`422`-`fieldErrors` erscheinen am korrekten Feld; Fehlermeldungen deutsch.
10. **Sicherheit (ADR-011):** Bio wird ohne `rehype-raw` und mit Allowlist-Sanitizing gerendert (XSS-Test mit `<script>`/`onerror` schlägt nicht durch); Chat ist Plaintext+Linkify; externe Links `rel="noopener"`.
11. **Mobile-First:** Bottom-Nav (Home/Flugtreffen/Gruppen/Chat) auf kleinen Viewports, Top-Navbar ab `md`; Chat-Badge zeigt Unread-Count.
12. **Theme:** Custom Light/Dark im Gleitschirm-Branding, Default=System, manueller Toggle persistiert über Reload; `data-theme` reagiert live auf System-Wechsel bei `'system'`.
13. **Notifications (ADR-008):** Bell-Badge und Chat-Badge zeigen gepollte Unread-Counts; Notification-Center listet, navigiert zur Quelle, markiert gelesen (Optimistic auf Count).
14. **i18n:** Alle Datums-/Zeitausgaben laufen über `format-de`; keine hartkodierten Datumsformate; UI durchgängig Deutsch.
15. **Performance:** Leaflet- und Chat-Routen sind lazy-split; Framer-Motion respektiert `prefers-reduced-motion`.

---

**Geänderte/relevante Dateien (Referenz für nachfolgende Implementierung):**
- `/Users/fabian/programming/fwe/frontend/.htaccess` bzw. die Projekt-Root-`.htaccess` — SPA-History-Fallback (§2.1).
- `/Users/fabian/programming/fwe/frontend/tsconfig.app.json`, `eslint.config.ts`, `vite.config.ts` — TS/Lint/Base-URL-Setup (§1).
- Quellen dieses Kapitels: `/Users/fabian/programming/fwe/spec/DECISIONS.md`, `/tmp/fm_dom/frontend-arch.json`, `/tmp/fm_dom/_crosscutting.json`.

Hinweis: Das ursprüngliche `frontend-arch.json` enthält durch spätere ADRs überholte Annahmen (Bearer-Token im `AuthStore`, `RealtimeStore`/Supabase-Channel). Dieses Kapitel löst beide zugunsten von **ADR-004 (HttpOnly-Session-Cookie, kein JS-Token)** und **ADR-001 (Polling, kein Realtime-Store)** auf.
