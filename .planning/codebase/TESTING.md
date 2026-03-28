# LeagueOps — Testing Patterns

## Test Framework

**Vitest** is the test runner. Configuration is in `vitest.config.ts` at the project root.

Key dependencies (from `package.json`):

| Package                       | Version   | Role                              |
| ----------------------------- | --------- | --------------------------------- |
| `vitest`                      | `^4.1.0`  | Test runner                       |
| `@testing-library/react`      | `^16.3.2` | React component testing utilities |
| `@testing-library/jest-dom`   | `^6.9.1`  | Custom DOM matchers               |
| `@testing-library/user-event` | `^14.6.1` | User interaction simulation       |
| `@vitejs/plugin-react`        | `^6.0.1`  | JSX/React support in Vite         |
| `jsdom`                       | `^29.0.0` | Browser environment simulation    |

---

## Vitest Configuration (`vitest.config.ts`)

```ts
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/**/*.{ts,tsx}', '**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'apps'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['node_modules', '.next', 'apps', '**/*.config.*'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

Key settings:

- **environment**: `jsdom` — all tests run in a simulated browser DOM
- **globals**: `true` — `describe`, `it`, `expect`, etc. are available without importing
- **setupFiles**: `./vitest.setup.ts` runs before each test file
- **include**: Two patterns — `__tests__/` directories anywhere, or `*.test.ts(x)` / `*.spec.ts(x)` co-located files
- **exclude**: `node_modules`, `.next`, and the `apps/` directory (sub-apps excluded)
- **coverage provider**: `v8` with `text` (terminal) and `lcov` (file) reporters
- **path alias**: `@/` resolves to project root, matching `tsconfig.json`

---

## Setup File (`vitest.setup.ts`)

```ts
import '@testing-library/jest-dom'
```

A single import that extends Vitest's `expect` with jest-dom matchers such as:

- `toBeInTheDocument()`
- `toHaveTextContent()`
- `toBeVisible()`
- `toHaveClass()`
- `toBeDisabled()`

---

## Test File Locations

### Current Structure

```
__tests__/
  lib/
    utils.test.ts       ← Unit tests for lib/utils.ts
```

Only one test file exists currently: `__tests__/lib/utils.test.ts`.

### Intended Pattern

Test files mirror the source tree under `__tests__/`:

```
__tests__/
  lib/
    utils.test.ts       ← tests for lib/utils.ts
    db.test.ts          ← would test lib/db.ts
    auth.test.ts        ← would test lib/auth.tsx
  components/
    ui.test.tsx         ← would test components/ui/index.tsx
    dashboard/
      DashboardTab.test.tsx
```

Alternatively, co-located `*.test.ts` files next to source files are also discovered by Vitest's `include` pattern.

---

## Test Structure & Style

### Imports

Tests import explicitly from `vitest`, even with `globals: true`:

```ts
import { describe, it, expect } from 'vitest'
```

Types are imported with `import type`:

```ts
import type { GameStatus } from '@/types'
```

Source under test is imported using the `@/` alias:

```ts
import { cn, statusColor, nextGameStatus } from '@/lib/utils'
```

### Organization

Tests use `describe` blocks per exported function, with `it` blocks per behavior:

```ts
describe('functionName', () => {
  it('describes the specific behavior', () => {
    expect(fn(input)).toBe(expected)
  })
})
```

### Assertion Style

- `expect(x).toBe(y)` for primitives
- `expect(x).toBeNull()` for null checks
- `expect(x).toHaveLength(n)` for arrays
- `expect(x).toEqual({ ... })` for object deep equality
- `expect(x).toContain('substring')` for partial string/array membership

### Data-Driven Tests

Table-driven tests use typed arrays with `forEach`:

```ts
const cases: Array<[GameStatus, string]> = [
  ['Scheduled', 'text-blue-300'],
  ['Live', 'text-green-400'],
]
cases.forEach(([status, expected]) => {
  expect(statusColor(status)).toBe(expected)
})
```

### Edge Cases Covered

The existing test suite in `__tests__/lib/utils.test.ts` demonstrates expected coverage patterns:

- **Happy path**: valid inputs produce correct outputs
- **Edge/boundary cases**: terminal states return `null`, single-word names return one initial
- **Falsy inputs**: `cn()` correctly ignores `false`, `undefined`, `null`
- **Missing optional data**: CSV parser fills missing columns with `''`
- **Invalid/short rows**: CSV parser skips rows with fewer than 2 columns
- **Whitespace**: CSV parser trims all fields

---

## Mocking Patterns

### Current Mocking

The existing test file (`__tests__/lib/utils.test.ts`) tests pure functions with no side effects — no mocking is needed.

### Expected Mocking Strategy for Future Tests

For component or hook tests that interact with Supabase or context:

**Supabase client mock** — mock `@/supabase/client`:

```ts
vi.mock('@/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
  }),
}))
```

**Context mock** — wrap component under test in a mock provider or mock the hook:

```ts
vi.mock('@/lib/store', () => ({
  useApp: () => ({
    state: mockState,
    updateGameStatus: vi.fn(),
  }),
}))
```

**`vi.fn()`** is the Vitest equivalent of `jest.fn()`.

---

## npm Scripts

```json
"test":          "vitest run"            // single run, no watch
"test:watch":    "vitest"                // watch mode
"test:coverage": "vitest run --coverage" // run with v8 coverage report
```

---

## Coverage Configuration

- **Provider**: `v8` (built into Node, no separate instrumentation)
- **Reporters**: `text` (printed to terminal) and `lcov` (written to `coverage/lcov.info` for CI/tooling)
- **Excluded from coverage**: `node_modules`, `.next`, `apps/`, all `*.config.*` files

---

## What Is and Isn't Tested

### Currently Tested

- `lib/utils.ts` — all exported pure functions: `cn`, `statusColor`, `statusBg`, `nextGameStatus`, `nextStatusLabel`, `initials`, `parseRosterCSV`

### Not Yet Tested

- Component rendering (no React component tests exist)
- Context providers (`AppProvider`, `AuthProvider`)
- Database layer (`lib/db.ts`)
- Engine modules (`lib/engines/referee.ts`, `weather.ts`, `field.ts`, `eligibility.ts`, `unified.ts`)
- API routes (`app/api/`)
- `generateSchedule` from `lib/utils.ts` (exported but not covered)

### Playwright

`@playwright/cli` is listed as a dev dependency — end-to-end tests are set up but no test files exist under the project root (the `apps/` directory is excluded from Vitest).

---

## Notes for Writing New Tests

1. Place test files under `__tests__/<mirror-of-source-path>/` or co-locate as `<file>.test.ts`
2. Import `describe`, `it`, `expect` (and `vi` for mocks) from `vitest` explicitly
3. Use `@/` alias for all source imports — it resolves to the project root per `vitest.config.ts`
4. Import types with `import type` to avoid runtime side effects
5. Pure utility functions need no mocking — test them directly
6. For components, use `@testing-library/react` `render` + `screen` + `@testing-library/user-event`
7. Supabase calls in `lib/db.ts` create a fresh client per function — mock `createClient` at the module level
8. The `AppProvider` and `AuthProvider` both throw if their hooks are called outside the provider — wrap components under test in lightweight mock providers
