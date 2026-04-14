# LeagueOps — Code Conventions

## Language & Framework

- **TypeScript** (strict mode off, but explicit types expected on all function signatures and interfaces)
- **Next.js 14 App Router** — all page files live under `app/`, all reusable components under `components/`
- All interactive components begin with `'use client'` as the first line
- Server components are the exception, not the rule — most files are client components

---

## File & Directory Naming

- Component files: **PascalCase** (e.g., `AppShell.tsx`, `DashboardTab.tsx`, `StatusBadge.tsx`)
- Library/utility files: **camelCase** (e.g., `utils.ts`, `db.ts`, `store.tsx`, `auth.tsx`)
- Engine files under `lib/engines/`: **camelCase** (e.g., `referee.ts`, `weather.ts`, `field.ts`)
- Directories: **lowercase** (e.g., `components/dashboard/`, `components/auth/`, `lib/engines/`)
- Test files: `__tests__/<module-path>/<file>.test.ts` (mirrors source structure)
- The single shared UI component barrel: `components/ui/index.tsx`
- All TypeScript types centralized in `types/index.ts`

---

## Import Conventions

- Path alias `@/` maps to the project root (configured in `vitest.config.ts` and `tsconfig.json`)
- Type-only imports use `import type { ... }` syntax consistently
- `* as db` namespace import is used for the database layer: `import * as db from '@/lib/db'`
- Named exports are preferred over default exports for all components and utilities
- Barrel re-exports are used for the UI kit: `import { StatusBadge, Modal, Btn } from '@/components/ui'`

---

## TypeScript Usage

### Type Definitions

All domain types live in `types/index.ts`. Key patterns:

- **Union string literals** for enums: `type GameStatus = 'Scheduled' | 'Starting' | 'Live' | 'Halftime' | 'Final' | 'Delayed'`
- **Interfaces** for all database row types (match Supabase schema column names)
- Joined relations are optional fields on the parent interface: `field?: Field`, `referees?: Referee[]`
- `Omit<T, 'id' | 'created_at' | ...>` used in action signatures when inserting new records
- `Partial<T>` used for update functions that accept a subset of fields
- Inline `import('@/types').Field` is used when importing inside callback types to avoid circular issues

### Context Typing

Contexts are typed with an explicit interface then `createContext<ContextValue | null>(null)`:

```ts
const Ctx = createContext<ContextValue | null>(null)

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
```

Both `AuthCtx` (`lib/auth.tsx`) and `Ctx` (`lib/store.tsx`) follow this pattern.

### Record<> Lookups

Status/type mappings always use `Record<UnionType, string>` with a fallback `?? 'default'`:

```ts
const map: Record<GameStatus, string> = {
  Scheduled: 'text-blue-300',
  Live: 'text-green-400',
  // ...
}
return map[status] ?? 'text-muted'
```

---

## Naming Conventions

### Variables & Functions

- **camelCase** for variables, functions, and React hooks
- **PascalCase** for React components, interfaces, and type aliases
- **SCREAMING_SNAKE_CASE** for module-level constants (e.g., `NAV_GROUPS`, `STATUS_CLASS`, `ROLE_BADGE`, `ALL_TABS`)
- Hook names begin with `use` (e.g., `useApp`, `useAuth`)
- Context variables shortened: `AuthCtx`, `Ctx` (not `AuthContext`, `AppContext`)

### Action Naming in Store

- `set` prefix for wholesale replacement: `SET_LOADING`, `SET_GAMES`, `SET_REFEREES`
- `update` prefix for single-item mutation: `UPDATE_GAME`, `UPDATE_REF`, `UPDATE_FIELD`
- `add` prefix for appending: `ADD_GAME`, `ADD_INCIDENT`, `ADD_OPS_LOG`
- `delete` prefix for removal: `DELETE_FIELD`
- Reducer actions use discriminated unions: `{ type: 'ACTION_TYPE'; payload: T }`

### Database Functions (`lib/db.ts`)

- `get<Entity>(eventId)` — fetch list: `getFields`, `getTeams`, `getReferees`
- `get<Entity>By<Criterion>` — filtered fetch: `getGamesByDate`
- `insert<Entity>` — create: `insertGame`, `insertField`, `insertIncident`
- `update<Entity><Property>` — targeted update: `updateGameStatus`, `updateFieldMap`, `updateFieldName`
- `toggle<Entity>Checkin` — boolean flip: `toggleRefCheckin`, `toggleVolCheckin`
- All db functions instantiate a fresh Supabase client per call: `const sb = createClient()`
- Functions return `data ?? []` for lists, `data ?? null` for single rows, `void` for mutations

---

## Component Patterns

### Tab Components

Each tab is a named export from `components/<feature>/<FeatureName>Tab.tsx`. They:

- Use `useApp()` to access state and actions from the store
- Use `useAuth()` for role-based rendering
- Keep local UI state (`useState`) for modal open/close, form inputs, selected items
- Use `toast.success(...)` / `toast.error(...)` from `react-hot-toast` for user feedback

### Shell & Layout

`AppShell.tsx` owns tab routing via `useState<TabName>`. It renders tabs with `{activeTab === 'dashboard' && <DashboardTab />}` conditionals — no Next.js router for tab navigation within the event shell.

### Loading State

Loading screens use the app's design language:

```tsx
<div className="h-screen flex items-center justify-center bg-surface">
  <div className="font-cond text-4xl font-black text-white mb-2 tracking-widest">LEAGUEOPS</div>
</div>
```

### Modals

Use the shared `Modal` component from `components/ui/index.tsx`. Props: `open`, `onClose`, `title`, `children`, `footer`. Clicking the backdrop closes the modal. Source: `components/ui/index.tsx` lines 122–158.

### UI Kit (`components/ui/index.tsx`)

All shared primitives are in a single file. Components:

| Component       | Purpose                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| `StatusBadge`   | Renders game status as a pill using CSS badge classes                                                |
| `Btn`           | Button with `variant` (`primary`/`danger`/`success`/`ghost`/`outline`) and `size` (`sm`/`md`/`lg`)   |
| `FormField`     | Label + children wrapper                                                                             |
| `Input`         | Styled `<input>` with shared base class                                                              |
| `Select`        | Styled `<select>` — always use solid `bg-[#040e24]`, never transparent (see Gotcha #4 in CONTEXT.md) |
| `Textarea`      | Styled `<textarea>`                                                                                  |
| `Card`          | `bg-surface-card` bordered container                                                                 |
| `SectionHeader` | Uppercase condensed label with bottom border                                                         |
| `Modal`         | Backdrop modal with title bar and optional footer                                                    |
| `CoverageBar`   | Progress bar for ref/vol coverage stats                                                              |
| `Avatar`        | Initials circle with color variant                                                                   |
| `Pill`          | Small colored tag                                                                                    |

### `cn()` Utility

All conditional class composition uses `cn()` from `lib/utils.ts`, which wraps `clsx` + `tailwind-merge`:

```ts
import { cn } from '@/lib/utils'
// Usage:
className={cn('base-class', condition && 'conditional-class', propClassName)}
```

---

## State Management

### Global State: AppProvider (`lib/store.tsx`)

- Uses `useReducer` with a typed `Action` discriminated union
- State covers: event, eventDates, fields, teams, games, referees, volunteers, incidents, medicalIncidents, weatherAlerts, opsLog, lightningActive, lightningSecondsLeft, loading
- Initial load: `Promise.all([...])` fetches all entities in parallel in a `loadAll()` async function inside `useEffect`
- Games reload on `currentDate` change via a separate `useEffect`
- Real-time updates: Supabase `channel('leagueops-realtime')` with `postgres_changes` listeners — all set up in a single `useEffect` returning cleanup `sb.removeChannel(sub)`
- Actions wrapped in `useCallback` with explicit dependency arrays
- Optimistic updates: dispatch the state change immediately, then call db function (or call db then dispatch for creates)

### Auth State: AuthProvider (`lib/auth.tsx`)

- `useEffect` gets initial session, then subscribes to `onAuthStateChange`
- `loadUserRole(userId)` fetches the first active row from `user_roles` after auth
- Exposes derived booleans: `isAdmin`, `isLeagueAdmin`, `isReferee`, `isVolunteer`, `canManage`

---

## Error Handling

- Supabase calls destructure `{ data, error }` but errors are generally not surfaced — `data ?? []` / `data ?? null` fallbacks are used
- User-facing errors shown via `toast.error(...)` from `react-hot-toast`
- Context hooks throw synchronously if used outside their provider: `throw new Error('useApp must be used within AppProvider')`
- CONTEXT.md notes: use explicit `try/catch` for engine functions — `.catch()` chains can silently break (see Gotcha #6)
- Supabase joined table filters with `.eq('teams.event_id', 1)` do NOT work in the JS client — always fetch IDs first, then use `.in('team_id', teamIds)` (see Gotcha #3)

---

## Tailwind Patterns

### Design Tokens (custom colors in `tailwind.config.js`)

```
surface.DEFAULT   #020810   (page background)
surface.panel     #030d20
surface.card      #081428   (card background)
surface.elevated  #0a1a3a
navy.DEFAULT      #0B3D91
navy.dark         #061f52
navy.light        #1a52b8
red.DEFAULT       #D62828
border            #1a2d50
muted             #5a6e9a
```

These map to Tailwind classes: `bg-surface`, `bg-surface-card`, `bg-navy`, `bg-red`, `border-border`, `text-muted`.

### Typography Classes

- All UI labels: `font-cond font-black tracking-[.12em] uppercase` (Barlow Condensed via `.font-cond` CSS class)
- Standard bold text: `font-cond font-bold`
- Numbers and scores: `font-mono` (Roboto Mono)
- Common label pattern: `font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase block mb-1.5`

### Common Class Patterns (from CONTEXT.md)

```
inp = 'w-full bg-[#081428] border border-[#1a2d50] text-white px-3 py-2.5 rounded-lg text-[13px] outline-none focus:border-blue-400'
lbl = 'font-cond text-[10px] font-black tracking-[.12em] text-[#5a6e9a] uppercase block mb-1.5'
```

### Status Badge Classes (defined in `app/globals.css`)

Use CSS class names directly — do not reconstruct with Tailwind utilities:

- `.badge-live` — green pill
- `.badge-scheduled` — blue pill
- `.badge-starting` — orange pill
- `.badge-halftime` — yellow pill
- `.badge-final` — gray pill
- `.badge-delayed` — red pill
- `.badge-suspended` — rose pill

### Animation Classes (defined in `app/globals.css`)

- `.live-dot` — pulsing ring animation for live indicators
- `.lightning-flash` — flashing red border for lightning delay state
- `.tab-content` — standard `padding: 12px 14px` for tab main area

### Opacity / Alpha Variants

Semi-transparent backgrounds use Tailwind's slash syntax: `bg-blue-900/30`, `bg-green-900/25`, `bg-black/75`. Used for colored overlays on status-colored elements.

### Grid Layouts

Responsive auto-fill grids: `grid-cols-[repeat(auto-fill,minmax(260px,1fr))]`

### Section Headers

Standard section header pattern with accent bar:

```tsx
<div className="flex items-center gap-3 mb-4">
  <div className="w-1 h-5 rounded-sm bg-red" />
  <span className="font-cond text-[13px] font-black tracking-[.15em] text-white uppercase">
    Section Title
  </span>
</div>
```

---

## Design System Patterns (from CONTEXT.md)

### Color Palette

| Token     | Hex     | Usage                  |
| --------- | ------- | ---------------------- |
| `#020810` | surface | Page background        |
| `#081428` | card    | Card/panel backgrounds |
| `#1a2d50` | border  | All borders            |
| `#5a6e9a` | muted   | Secondary text, labels |
| `#0B3D91` | navy    | Primary action color   |
| `#D62828` | red     | Danger/alert color     |

### CSS Custom Properties (`app/globals.css`)

```css
--navy: #0b3d91;
--navy-dark: #061f52;
--navy-light: #1a52b8;
--red: #d62828;
--surface: #020810;
--card: #081428;
--border: #1a2d50;
--muted: #5a6e9a;
```

### Global Scrollbar

Thin 3px scrollbar defined globally: track transparent, thumb `#1a2d50`, 2px border-radius. `html, body` have `overflow: hidden` — only inner containers scroll.

### Select Option Background

`app/globals.css` forces `select option { background-color: #020810; color: #ffffff; }` to prevent white dropdown options on dark backgrounds.

---

## Linting & Formatting

- **ESLint**: `eslint-config-next` + `eslint-config-prettier`
- **Prettier**: auto-format via `npm run format` or `npm run format:check`
- **Husky + lint-staged**: pre-commit hook runs Prettier on all `*.{ts,tsx,js,jsx,json,css,md}` files
- **Type checking**: `npm run type-check` runs `tsc --noEmit`
- Scripts: `npm run lint`, `npm run lint:fix`, `npm run format`, `npm run type-check`

---

## Multi-Event / Event Scoping

- Every Supabase query must be scoped with `.eq('event_id', eventId)`
- `eventId` flows from URL slug resolution in `app/e/[slug]/page.tsx` → `AppProvider` prop
- Never hardcode `event_id: 1` in new code (legacy code uses this — being migrated)
- `AppProvider` accepts `eventId?: number` defaulting to `1` for backward compatibility
