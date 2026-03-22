# LeagueOps — Technology Stack

## Language & Runtime

- **Language**: TypeScript `^5.4.5` (strict mode, `noEmit`, target `es2017`)
- **Runtime**: Node.js (via Next.js)
- **JSX**: React with `preserve` transform (handled by Next.js compiler)

## Framework

- **Next.js** `14.2.4` — App Router, React Server Components, Route Handlers
  - Config: `next.config.js`
  - TypeScript plugin: `{ "name": "next" }` in `tsconfig.json`
  - `next-env.d.ts` — auto-generated ambient types

## Frontend

- **React** `^18.3.1` with `react-dom ^18.3.1`
- **React Context** — two custom providers:
  - `lib/auth.tsx` — `AuthProvider` / `useAuth()` for session and role state
  - `lib/store.tsx` — `AppProvider` / `useApp()` for global tournament state with `useReducer`
- **react-hot-toast** `^2.4.1` — toast notifications, rendered globally in `app/layout.tsx`

## Styling

- **Tailwind CSS** `^3.4.4`
  - Config: `tailwind.config.js`
  - Custom color palette: `navy`, `red`, `surface`, `border`, `muted`
  - Custom font families: `sans` (Barlow), `condensed` (Barlow Condensed), `mono` (Roboto Mono)
  - Content paths: `./pages/**`, `./components/**`, `./app/**`
- **PostCSS** `^8.4.38` with `autoprefixer ^10.4.19`
  - Config: `postcss.config.js`
- **tailwind-merge** `^2.3.0` — conditional class merging utility
- **clsx** `^2.1.1` — conditional className construction

## Fonts

Loaded via `next/font/google` in `app/layout.tsx`:
- **Barlow** (weights 400, 500, 600) — `--font-barlow`
- **Barlow Condensed** (weights 400, 600, 700, 800, 900) — `--font-barlow-condensed`
- **Roboto Mono** (weights 400, 500) — `--font-roboto-mono`

## UI Components & Libraries

- **lucide-react** `^0.395.0` — icon library
- **@dnd-kit/core** `^6.1.0` — drag-and-drop primitives
- **@dnd-kit/sortable** `^8.0.0` — sortable drag-and-drop
- **@dnd-kit/utilities** `^3.2.2` — dnd-kit helper utilities
- **date-fns** `^3.6.0` — date formatting and arithmetic

## Database Client

- **@supabase/supabase-js** `^2.99.2` — Supabase JS client
- **@supabase/ssr** `^0.9.0` — SSR-safe Supabase helpers
  - `supabase/client.ts` — browser client via `createBrowserClient`
  - `supabase/server.ts` — server client via `createServerClient` with cookie forwarding

## Path Aliases

- `@/*` → project root (e.g., `@/lib/db`, `@/supabase/client`, `@/types`)
- Configured in both `tsconfig.json` and `vitest.config.ts`

## Testing

- **Vitest** `^4.1.0` — test runner
  - Config: `vitest.config.ts`
  - Environment: `jsdom` via `jsdom ^29.0.0`
  - Coverage provider: `v8` with `text` + `lcov` reporters
- **@testing-library/react** `^16.3.2`
- **@testing-library/jest-dom** `^6.9.1` (imported in `vitest.setup.ts`)
- **@testing-library/user-event** `^14.6.1`
- **@vitejs/plugin-react** `^6.0.1` — Vite React transform for Vitest
- **@playwright/cli** `^0.1.1` — end-to-end test CLI (installed, not yet configured)
- Test files: `**/__tests__/**/*.{ts,tsx}` and `**/*.{test,spec}.{ts,tsx}`

## Linting & Formatting

- **ESLint** `^8.57.1`
  - Config: `.eslintrc.json`
  - Extends: `next/core-web-vitals`, `prettier`
  - Custom rules: `no-console` (warn, allow `warn`/`error`), `prefer-const` (error), `react/no-unescaped-entities` (warn)
- **Prettier** `^3.8.1`
- **eslint-config-prettier** `^10.1.8` — disables formatting rules that conflict with Prettier
- **eslint-config-next** `14.2.4`

## Git Hooks

- **Husky** `^9.1.7` — git hooks manager
- **lint-staged** `^16.4.0` — runs Prettier on staged files
  - `.{ts,tsx,js,jsx}` → `prettier --write`
  - `.{json,css,md}` → `prettier --write`

## Build & Scripts

- `npm run dev` — `next dev`
- `npm run build` — `next build`
- `npm run start` — `next start`
- `npm run lint` — `next lint`
- `npm run lint:fix` — `next lint --fix`
- `npm run format` — `prettier --write .`
- `npm run format:check` — `prettier --check .`
- `npm run type-check` — `tsc --noEmit`
- `npm run test` — `vitest run`
- `npm run test:watch` — `vitest`
- `npm run test:coverage` — `vitest run --coverage`
- `npm run db:seed` — `npx tsx supabase/seed.ts`

## TypeScript Configuration

- **`tsconfig.json`** (root — main app)
  - `strict: true`, `isolatedModules: true`, `resolveJsonModule: true`
  - `moduleResolution: bundler`, `module: esnext`
  - Excludes `node_modules` and `apps/` (sub-apps have separate tsconfigs)
- **`tsx`** `^4.15.5` — TypeScript executor for scripts (used by `db:seed`)

## Sub-Application: `apps/public-results`

A separate, standalone Next.js `14.2.4` app serving the public-facing tournament results viewer.

- **Config**: `apps/public-results/package.json`, `apps/public-results/tsconfig.json`
- **Port**: `3001` (dev and start scripts use `-p 3001`)
- **Dependencies**: `@supabase/supabase-js ^2.43.0`, `next`, `react`, `react-dom`, `clsx`, Tailwind CSS stack
- Excluded from root `tsconfig.json` and Vitest config

## Directory Structure (key paths)

```
leagueops/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/                # Route Handlers
│   │   ├── admin/
│   │   ├── assignments/
│   │   ├── auth/
│   │   ├── checkins/
│   │   ├── conflicts/
│   │   ├── eligibility/
│   │   ├── field-engine/
│   │   ├── fields/
│   │   ├── games/
│   │   ├── incidents/
│   │   ├── join/
│   │   ├── lightning/
│   │   ├── medical/
│   │   ├── ops-log/
│   │   ├── payment-entries/
│   │   ├── players/
│   │   ├── referee-engine/
│   │   ├── referees/
│   │   ├── registration-fees/
│   │   ├── rules/
│   │   ├── team-payments/
│   │   ├── teams/
│   │   ├── volunteers/
│   │   ├── weather/
│   │   └── weather-engine/
│   ├── checkin/
│   ├── join/
│   ├── register/
│   ├── layout.tsx
│   └── page.tsx
├── components/             # Shared React components
├── lib/
│   ├── auth.tsx            # Auth context provider
│   ├── db.ts               # Supabase data access layer
│   ├── store.tsx           # Global state context (useReducer)
│   ├── utils.ts
│   ├── index.ts
│   └── engines/            # Business logic engines
│       ├── eligibility.ts
│       ├── field.ts
│       ├── referee.ts
│       ├── rules.ts
│       ├── unified.ts
│       └── weather.ts
├── supabase/
│   ├── client.ts           # Browser Supabase client
│   ├── server.ts           # Server Supabase client
│   └── *.sql               # Schema and migration files
├── types/
│   └── index.ts
├── apps/
│   └── public-results/     # Standalone public results viewer
├── __tests__/
├── public/
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── postcss.config.js
├── .eslintrc.json
├── vitest.config.ts
└── vitest.setup.ts
```
