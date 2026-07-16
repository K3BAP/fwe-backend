# FlightMeet — Frontend

React-19/TypeScript-SPA (Vite 8, Tailwind v4 + DaisyUI v5). Projekt-Überblick, Setup und
Konventionen: siehe [README im Repo-Root](../README.md) und [`spec/05-frontend.md`](../spec/05-frontend.md).

```bash
npm install
npm run dev          # http://localhost:5180 — proxied /api + /media → CI4 auf :8080
npm run typecheck && npm run lint && npm run test   # Gate vor jedem Commit
npm run build        # Prod-Build nach ../public/ (base /public/)
```

Die Zod-Schemas unter `src/api/schemas/` sind der **bindende API-Vertrag** (`z.infer` = Typquelle);
`src/config.ts` hält die `USE_MOCKS`-Naht (ADR-016) und die Polling-Intervalle (ADR-001).
