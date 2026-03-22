# Stack Research

Researched 2026-03-22 for LeagueOps (Next.js 14.2.4 + Supabase + Vercel).
Covers the six feature areas in the current Active milestone. All choices are
additive — no framework changes, no stack replacement.

---

## Notifications (Email / SMS / Push)

### Email — Resend

**Package**: `resend ^3.x` (current stable is 3.5.0)
**Free tier**: 3,000 emails/month, 100/day — sufficient for tournament-scale
event notifications (weather alerts, schedule changes).

**Rationale**: Resend is the de-facto standard for transactional email in
Next.js/Vercel apps in 2025-2026. First-class TypeScript SDK, React Email
component support, simple API key auth, and a Vercel marketplace integration
that sets the env var automatically. The SDK wraps a single POST call and
returns typed results.

**Integration point**: Create a Supabase Edge Function `notify-email` that
accepts a `{ to, subject, template, data }` payload. The Edge Function calls
Resend. Next.js API routes (e.g., `app/api/games/[id]/route.ts` on status
change) enqueue notifications by invoking the Edge Function via
`supabase.functions.invoke()`. This keeps the API key server-only and off
Vercel's Next.js runtime.

**React Email** (`@react-email/components ^0.0.x`, `react-email ^3.x`):
Companion library. Write notification templates as `.tsx` files under
`emails/`. `renderAsync()` converts them to HTML strings at send time.
Provides off-the-shelf components (Button, Hr, Text, Link, Section) that
render consistently in Outlook/Gmail. Not strictly required — plain HTML
strings work fine — but makes maintaining templates much easier.

**What NOT to use**:
- **SendGrid** — 100 email/day free limit (too low), heavyweight SDK, poor
  DX compared to Resend.
- **Nodemailer** — requires an SMTP server (no free option on Vercel
  serverless), adds infrastructure complexity.
- **Postmark** — no meaningful free tier.

---

### SMS — Twilio (free trial) → Telnyx (production cheapest)

**Free trial**: Twilio provides a free trial number with ~$15 credit, enough
to prototype and run a small season. No monthly fee during trial.

**Production (cheapest paid)**: Telnyx at ~$0.004/SMS outbound (US) vs
Twilio's ~$0.0079. For a tournament sending ~200 schedule-change SMS per
event, Telnyx costs under $1/event.

**Package** (for either): use plain `fetch` to their REST APIs — no SDK
needed. Both expose a simple POST endpoint. Keep the call inside a Supabase
Edge Function to protect credentials.

**Telnyx API** (production path):
```
POST https://api.telnyx.com/v2/messages
Authorization: Bearer {TELNYX_API_KEY}
{ from: "+1...", to: "+1...", text: "..." }
```

**What NOT to use**:
- **Vonage/Nexmo free tier** — removed their free SMS tier in 2024.
- **TextBelt free tier** (`textbelt.com`) — 1 SMS/day global, unusable.
- **AWS SNS** — adds AWS account complexity; no meaningful cost advantage at
  this scale.
- **Bandwidth** — requires business approval, not self-serve.

**Practical note on SMS budget**: SMS notification opt-in should be explicit
and stored per-user. Send SMS only for P0 alerts (lightning delay, game
cancellation) to keep volume low. Weather advisories and schedule-request
updates can be email-only by default.

---

### Push Notifications (Browser / PWA)

**Library**: `web-push ^3.6.x` inside a Supabase Edge Function.

**What this enables**: PWA-style browser push even without a native app.
Users visit the admin shell or public results site, click "Enable
notifications", and the browser registers a push subscription
(`PushSubscription` object). That subscription is saved to a new
`push_subscriptions` table in Supabase. When an event fires (weather alert,
game status change), the Edge Function reads subscriptions and sends via the
VAPID-signed Web Push protocol.

**Client side**: Use the browser's native `serviceWorker` + `PushManager`
API directly — no library needed on the client. Create
`public/sw.js` (service worker) that handles `push` events and calls
`self.registration.showNotification()`.

**VAPID keys**: Generate once with `web-push generate-vapid-keys`, store as
env vars (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).

**What NOT to use**:
- **Firebase Cloud Messaging (FCM)** — adds a Google dependency, requires
  registering a Firebase project, and the SDK is heavier than needed for a
  web-only push use case. FCM is the right answer for React Native; overkill
  here.
- **OneSignal** — free tier is generous, but adds third-party data sharing
  and is unnecessary when `web-push` + Supabase covers the requirement.
- **Pusher Beams** — paid-only beyond a trivial limit.

**Schema addition needed**:
```sql
CREATE TABLE push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users NOT NULL,
  event_id   integer REFERENCES events NOT NULL,
  endpoint   text NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

---

### Notification Orchestration — Supabase Edge Functions

All three channels (email, SMS, push) should be called from **Supabase Edge
Functions**, not from Next.js API routes. Reasons:

1. Credentials stay in Supabase secrets, not in Vercel env — fewer places to
   manage.
2. Edge Functions can be triggered by **Supabase Database Webhooks** on table
   changes (e.g., `games` status → `Cancelled`, `schedule_change_requests`
   status → `approved`). This is zero-cost event-driven delivery.
3. Avoids Vercel function cold-start latency on notification paths.

Create one Edge Function per notification type:
- `supabase/functions/notify-weather-alert/index.ts`
- `supabase/functions/notify-schedule-change/index.ts`
- `supabase/functions/notify-admin-alert/index.ts`

Each function reads the affected rows, resolves recipient preferences, and
fans out to email/SMS/push based on per-user channel settings.

---

## Google Maps Integration

### Library Choice — `@vis.gl/react-google-maps ^1.x`

**Current stable**: `1.4.0`

This is the official Google Maps Platform React wrapper (successor to
`@react-google-maps/api`). Maintained by the `vis.gl` team (deck.gl authors)
with Google's backing.

**What it provides**:
- `<APIProvider apiKey={...}>` wrapper
- `<Map>`, `<Marker>`, `<AdvancedMarker>` components
- `useMapsLibrary('places')` hook for Places API access
- Full TypeScript types

**For venue search specifically** — use the **Places Autocomplete** widget:

```tsx
import { useMapsLibrary } from '@vis.gl/react-google-maps'

// Inside EventSetupTab or a ComplexForm component:
const places = useMapsLibrary('places')
// attach PlaceAutocompleteElement or use Autocomplete class
// on selection: extract place.geometry.location (lat/lng),
//               place.formatted_address, place.place_id
```

On selection, save to the `complexes` table:
```
complexes.lat         = place.geometry.location.lat()
complexes.lng         = place.geometry.location.lng()
complexes.address     = place.formatted_address
complexes.place_id    = place.place_id   ← add this column
complexes.name        = place.name
```

**Env var**: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — this one legitimately goes
public (Maps JS API keys are restricted by referrer/origin in the Google
Cloud console, not kept secret). Restrict the key to: Maps JavaScript API +
Places API, HTTP referrers: `leagueops.vercel.app/*`.

**Cost**: Maps JS API + Places Autocomplete — $0 for the first $200/month of
usage (Google's monthly free credit). For a tournament management tool with
one venue lookup per event, this is effectively free indefinitely.

**What NOT to use**:
- **`@react-google-maps/api`** — older community wrapper, less maintained
  since vis.gl took over.
- **`google-maps-react`** — unmaintained since 2022.
- **Mapbox** — not free beyond 50,000 map loads/month; requires a separate
  account and different API. No benefit here since the requirement is a
  single venue lookup per event creation, not a full mapping experience.
- **Leaflet + OpenStreetMap geocoding** — free but the Nominatim geocoder is
  unreliable for address disambiguation and does not match the "Google Maps
  for complex lookup" requirement in EVT-01.

**Places Autocomplete (new API)**: Google is retiring the legacy
`google.maps.places.Autocomplete` class in 2025. Use
`google.maps.places.PlaceAutocompleteElement` (the new `<gmp-placeautocomplete>`
web component) or the Places API (New) via `useMapsLibrary('places')` to stay
forward-compatible.

---

## Public Results Site Architecture

The `apps/public-results` skeleton already exists as a separate Next.js
14.2.4 app. The architecture question is: how do real-time scores reach
anonymous visitors efficiently?

### Approach: ISR + Supabase Realtime (hybrid)

**Static shell, real-time data**: Server-render the page skeleton with ISR
(`revalidate = 30`) for SEO and initial load speed. After hydration, open a
**Supabase Realtime subscription** scoped to the event (filter:
`event_id=eq.{slug}`) to receive live score updates without polling.

This is the right tradeoff:
- Parents who load the page get a fast first paint (ISR).
- Live scores update within seconds without page refresh (Realtime WS).
- No custom WebSocket server needed.

**Libraries to add to `apps/public-results`**:

```json
"@supabase/supabase-js": "^2.99.2",
"@supabase/ssr": "^0.9.0"
```

The sub-app already has `@supabase/supabase-js ^2.43.0` — pin it to the same
`^2.99.2` as the main app to avoid duplicate bundle versions.

**No additional UI library needed** — the dark design system (Tailwind,
Barlow Condensed, navy/red palette) should be ported to the sub-app's
`tailwind.config.js` to maintain brand consistency.

### Bracket Visualization

**Library**: `react-brackets ^0.5.x` or **write a custom CSS grid bracket**.

`react-brackets` is a lightweight, dependency-free bracket renderer (single
elimination, double elimination). It accepts a `rounds` array and renders
match cards. No canvas, no SVG complexity.

**Recommendation**: For the scope of PUB-04 (tournament bracket
visualization), write a simple custom CSS grid bracket using Tailwind rather
than adding a library dependency. A single-elimination bracket for 8-16 teams
is 40-60 lines of JSX with flexbox. Avoids a library that is not actively
maintained.

**What NOT to use**:
- **`@g-loot/react-tournament-brackets`** — abandoned in 2023.
- **D3** — massive bundle weight for a simple bracket; overkill.
- **chart.js** — wrong tool for bracket trees.

### QR Code for Parent Team Lookup (PUB-05)

**Library**: `qrcode ^1.5.x` (Node.js, server-side) or `qrcode.react ^3.x`
(client-side React component).

For public results, use `qrcode.react` — renders a QR code as an inline SVG
that parents can scan to go directly to their team's view. Extremely
lightweight (7 KB gzipped).

```tsx
import { QRCodeSVG } from 'qrcode.react'
<QRCodeSVG value={`https://leagueops.vercel.app/results/e/${slug}?team=${teamId}`} size={200} />
```

The main admin app already uses QR tokens for player check-in. Reuse the same
approach: deep-link URL + server-generated QR image.

### Vercel Deployment for Sub-App

The sub-app lives at `apps/public-results/`. Deploy it as a **second Vercel
project** pointing to the same repo with the root directory set to
`apps/public-results`. This gives it a separate URL (e.g.,
`leagueops-results.vercel.app` or a custom domain). No monorepo tooling
(Turborepo, Nx) is needed — Vercel handles this natively with the
"Root Directory" project setting.

---

## RLS & Auth Hardening

This is the P0/P1 security work (SEC-01 through SEC-06) and does not require
new npm packages. It is a code and SQL change task.

### Auth Check Pattern for API Routes

The two routes that already check auth provide the pattern to replicate:

```typescript
// Standard auth guard — add to top of every route handler
const supabase = createClient() // supabase/server.ts
const { data: { user }, error } = await supabase.auth.getUser()
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

For admin-only routes, additionally check the user's role:
```typescript
const { data: role } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)
  .single()
if (!role || !['admin', 'league_admin'].includes(role.role)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

**No library needed** — `@supabase/ssr` already provides the server client
with cookie-based auth. The pattern is just two missing lines per route.

### Input Validation — Zod

**Package**: `zod ^3.23.x` (current stable 3.23.8)

40+ routes currently do `supabase.from('table').insert(body)` with no
validation. Zod provides schema-first runtime validation with TypeScript type
inference. Add a schema per route and call `.parse(body)` before touching the
database:

```typescript
import { z } from 'zod'

const CreateGameSchema = z.object({
  event_id: z.number().int().positive(),
  field_id: z.number().int().positive(),
  home_team_id: z.number().int().positive(),
  away_team_id: z.number().int().positive(),
  scheduled_time: z.string().regex(/^\d{1,2}:\d{2}\s*(AM|PM)$/i),
  event_date_id: z.number().int().positive(),
})
```

This also forces the server to control `event_id` (prevents callers from
writing to arbitrary events) and eliminates the `as any` casts caused by
untyped request bodies.

**What NOT to use**:
- **Joi** — CommonJS-only, worse TypeScript inference than Zod.
- **Yup** — async-only validation model is awkward in Route Handlers.
- **Manual validation** — 40+ routes means manual checks will be
  inconsistent. Zod schemas are composable and testable.

### RLS Policies

**No npm packages** — pure SQL. Replace each `"Allow all"` policy with
role-specific policies. The required pattern for event-scoped tables:

```sql
-- Drop the permissive policy
DROP POLICY "Allow all" ON games;

-- Authenticated read (any logged-in user can read games)
CREATE POLICY "games_select" ON games
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE ur.event_id = e.id OR ur.role IN ('admin', 'super_admin')
    )
  );

-- Writes only for admins/league_admins
CREATE POLICY "games_insert" ON games
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'league_admin')
        AND (event_id = games.event_id OR role = 'admin')
    )
  );
```

**Public results**: The `apps/public-results` app reads with the anon key and
no auth. Add a separate `FOR SELECT TO anon` policy on the tables it reads
(`events`, `games`, `teams`, `fields`) scoped to `is_public = true` events.
This avoids exposing all event data to unauthenticated requests.

### Server-Side Supabase Client in Engines

Currently all engines import `@/supabase/client` (browser client). Fix: pass
the server client as a parameter or create a factory function.

**Recommended refactor** — engine factory pattern:

```typescript
// lib/engines/weather.ts
export function createWeatherEngine(supabase: SupabaseClient) {
  return {
    async run(complexId: number, eventId: number) { ... }
  }
}

// app/api/weather-engine/route.ts
import { createClient } from '@/supabase/server'
import { createWeatherEngine } from '@/lib/engines/weather'

export async function POST(request: Request) {
  const supabase = createClient()
  const engine = createWeatherEngine(supabase)
  // ...
}
```

No new packages needed. This is a refactor task.

### Rate Limiting — Upstash Redis (Vercel Integration)

**Package**: `@upstash/ratelimit ^2.x`, `@upstash/redis ^1.x`
**Free tier**: Upstash Redis — 10,000 requests/day free, no credit card.
Vercel one-click integration auto-sets `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN`.

Apply rate limiting to the expensive/sensitive routes:

```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
})

// In route handler:
const { success } = await ratelimit.limit(user?.id ?? ip)
if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
```

Target routes: `weather-engine`, `referee-engine`, `field-engine`,
`auth/check-email`, `join`.

**What NOT to use**:
- **Vercel KV** — same Upstash under the hood, but accessed through Vercel's
  abstraction. Using `@upstash/ratelimit` directly gives more control and
  avoids Vercel vendor lock-in on the data layer.
- **In-memory rate limiting** — does not work across serverless function
  instances.

---

## Responsive Design Tools

### No New Libraries Needed

The existing stack (Tailwind CSS 3.4.4 + clsx + tailwind-merge) is fully
sufficient for responsive design. The work is applying responsive prefixes
(`sm:`, `md:`, `lg:`) to existing components and rethinking layouts for
narrow viewports.

**Tailwind breakpoints** (already configured):
- `sm` = 640px (large phone landscape)
- `md` = 768px (tablet portrait)
- `lg` = 1024px (tablet landscape / laptop)

The admin shell (TopBar + StatusRow + main + RightPanel) needs specific
responsive treatment:

**TopBar**: Convert grouped nav dropdowns to a hamburger menu on `sm`.
Recommend `<details>/<summary>` or a simple `useState` toggle — no library.

**RightPanel** (288px fixed sidebar): On mobile (`< md`), convert to a
bottom drawer or a slide-over panel triggered by a button. Use Tailwind
`translate-x-full` / `translate-x-0` with a CSS transition. No library.

**AppShell main content**: Already `flex-1 overflow-y-auto`. Ensure all tab
components have `w-full min-w-0` to prevent horizontal overflow.

**Data tables** (ScheduleTab, RostersTab, etc.): Convert to card-stack layout
on mobile using Tailwind's `hidden sm:table-cell` pattern on non-critical
columns, with a card view rendered for `sm:hidden`.

**Touch interactions**: The park map (drag/resize/rotate fields) uses custom
mouse events. Extend with `onTouchStart`/`onTouchMove`/`onTouchEnd` handlers
— no new library needed. `@dnd-kit` (already installed) already supports
touch via its `TouchSensor`.

**What NOT to add**:
- **Headless UI / Radix UI** — useful if building a component library from
  scratch, but LeagueOps has its own design system in `components/ui/`. Adding
  Radix now would create two parallel component systems. If a specific
  accessible component is needed (e.g., a dialog), use the existing `Modal`
  primitive.
- **Framer Motion** — animation library; adds ~60 KB. The slide-over panel
  animation can be done with a CSS transition in 4 lines of Tailwind.
- **React Native Web** — the project decision is responsive web, not
  cross-platform. Not applicable.

**Testing responsive layouts**: Use Playwright (already installed as
`@playwright/cli`) for viewport-based tests. Configure `playwright.config.ts`
and add a smoke test at `375px` (iPhone SE) and `768px` (iPad) widths as part
of MOB-01 work.

---

## Schedule Change Request Workflow

### No New Libraries — Database + UI Pattern

The SCH-01 through SCH-06 workflow is a state machine over a new
`schedule_change_requests` table. No new packages required.

**Suggested schema**:
```sql
CREATE TABLE schedule_change_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      integer REFERENCES events NOT NULL,
  game_id       integer REFERENCES games NOT NULL,
  requester_id  uuid REFERENCES auth.users NOT NULL,
  type          text CHECK (type IN ('reschedule', 'cancel')) NOT NULL,
  reason        text NOT NULL,
  preferred_alt text,
  status        text DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'denied', 'completed')),
  admin_note    text,
  suggested_slots jsonb,  -- array of {field_id, date, time} options
  created_at    timestamptz DEFAULT now(),
  resolved_at   timestamptz
);
```

**Alternative slot suggestion** (SCH-04): On approval, the existing
`findAvailableRefs()` pattern in `lib/engines/referee.ts` should be extended
to a `findAvailableSlots(gameId, eventId)` function that queries open
field+time combinations. No new library — it is a SQL query over existing
`games` and `field_blocks` tables.

**Notifications on approval/denial**: Trigger a Database Webhook on
`schedule_change_requests.status` change → invoke `notify-schedule-change`
Edge Function (see Notifications section above).

---

## Coach Self-Registration

### No New Libraries

REG-03 through REG-05 (coach self-registration + conflict detection) follows
the same token pattern already used for referee self-registration
(`registration_invites` table, `app/join/[token]/page.tsx`). Extend it:

**New table** (or extend `registration_invites`):
```sql
CREATE TABLE coach_invite_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  integer REFERENCES programs NOT NULL,
  team_id     integer REFERENCES teams NOT NULL,
  event_id    integer REFERENCES events NOT NULL,
  token       text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  expires_at  timestamptz DEFAULT now() + interval '7 days',
  claimed_at  timestamptz,
  created_by  uuid REFERENCES auth.users NOT NULL
);
```

**Conflict detection** (REG-05): Query `user_roles` + `ref_assignments` (or
a new `coach_assignments` table if coaches are assigned to games, not just
teams) to detect same-coach multiple-team overlaps. Pure SQL, no library.

**QR code for invite link**: Use `qrcode.react` (already recommended for
public results) to render the shareable link as a QR code in the program
leader dashboard. Install once, use in both places.

---

## Recommendations Summary

| Feature Area | Add | Version | Why |
|---|---|---|---|
| Email notifications | `resend` | `^3.5.0` | Best DX, generous free tier, native Vercel integration |
| Email templates | `@react-email/components`, `react-email` | `^0.0.x`, `^3.x` | Maintainable HTML email templates as React components |
| SMS notifications | Telnyx REST API (no SDK) | — | Cheapest US SMS (~$0.004/SMS), simple REST call |
| Browser push | `web-push` (Edge Function only) | `^3.6.x` | Native Web Push protocol, no third-party dependency |
| Google Maps venue lookup | `@vis.gl/react-google-maps` | `^1.4.0` | Official Google-backed React wrapper, Places Autocomplete support |
| Input validation | `zod` | `^3.23.x` | Schema-first validation, TypeScript inference, composable |
| Rate limiting | `@upstash/ratelimit`, `@upstash/redis` | `^2.x`, `^1.x` | 10k req/day free, Vercel one-click integration |
| QR codes (results + coach invite) | `qrcode.react` | `^3.x` | Lightweight SVG QR output, already-familiar pattern |
| Bracket visualization | Custom Tailwind CSS | — | 8-16 team bracket is 60 lines of JSX; no abandoned library dependency |
| Responsive layout | Tailwind responsive prefixes | (existing 3.4.4) | No new library needed; Tailwind + existing `@dnd-kit` covers it |
| Public results real-time | Supabase Realtime (existing SDK) | (existing ^2.99.2) | Already used in main app; free, no new library |
| RLS policies | SQL migrations | — | No library; pure PostgreSQL policy definitions |
| API auth guard | `@supabase/ssr` (existing) | (existing ^0.9.0) | `auth.getUser()` already available; missing calls, not missing library |
| Engine client fix | Refactor (no new library) | — | Pass server client as parameter; removes browser client from server context |

### What to NOT Add

| Candidate | Reason to Skip |
|---|---|
| SendGrid | 100 email/day free limit; worse DX than Resend |
| Twilio (production) | 2x price of Telnyx for US SMS |
| Firebase Cloud Messaging | Google dependency, SDK overhead — overkill for web push |
| OneSignal | Third-party data sharing; unnecessary with native Web Push |
| Mapbox | Not free at scale; wrong tool for single venue lookup |
| Leaflet + Nominatim | Geocoding reliability insufficient for venue search |
| Radix UI / Headless UI | Creates parallel component system alongside existing `components/ui/` |
| Framer Motion | 60 KB for animations achievable in 4 lines of Tailwind |
| react-brackets library | Abandoned; simple bracket is faster to write in Tailwind |
| Turborepo / Nx | Monorepo tooling overhead not justified for 2 Next.js apps |
| Stripe | Explicitly out of scope |
| Joi / Yup | Worse TypeScript ergonomics than Zod |

### Delivery Order (Priority-Aligned)

1. **RLS + API auth** (SEC-01/02): SQL migrations + auth guard pattern —
   no new packages, highest priority, unblocks everything else.
2. **Zod** + `@upstash/ratelimit`: Install alongside security fixes —
   validate inputs while adding auth guards.
3. **Engine refactor** (SEC-03): Pass server Supabase client to engines —
   no new packages.
4. **`@vis.gl/react-google-maps`**: Add to main app for EVT-01 venue
   lookup.
5. **`resend` + `react-email`**: Install for email; wire to Edge Function
   for NOT-04.
6. **`web-push`**: Add to Edge Function runtime for NOT-06 browser push.
7. **Responsive design**: Tailwind-only work across existing components
   for MOB-01.
8. **Public results real-time + `qrcode.react`**: Upgrade sub-app Supabase
   version, add Realtime subscription, add QR output.
9. **Schedule change request + coach self-registration**: SQL + API routes
   + UI; no new packages beyond what's already installed.

### Environment Variables to Add

| Variable | Where | Purpose |
|---|---|---|
| `RESEND_API_KEY` | Supabase secrets + Vercel | Resend email sending |
| `TELNYX_API_KEY` | Supabase secrets | SMS sending |
| `VAPID_PUBLIC_KEY` | Vercel + Supabase secrets | Web Push public key |
| `VAPID_PRIVATE_KEY` | Supabase secrets only | Web Push private key |
| `VAPID_SUBJECT` | Supabase secrets | Web Push contact mailto |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Vercel | Maps JS + Places API (referrer-restricted) |
| `UPSTASH_REDIS_REST_URL` | Vercel (auto via integration) | Rate limit Redis |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel (auto via integration) | Rate limit Redis auth |
| `OPENWEATHER_API_KEY` | Vercel (rename from NEXT_PUBLIC_) | Weather engine — server only |

---
*Generated 2026-03-22*
