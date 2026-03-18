# LeagueOps Public Results

A standalone Next.js application that provides a public-facing view of tournament results, standings, and live scores. No login required.

## Features

- **Event listing** — browse all tournaments
- **Standings** — W/L/T table with GF/GA/GD/PTS, sortable by division
- **Results** — completed game scores grouped by division
- **Live scores** — games currently in progress with real-time badge

## Setup

```bash
# Install dependencies
npm install

# Copy env vars (same Supabase project as the main app)
cp .env.example .env.local

# Dev server (runs on port 3001)
npm run dev
```

## Deployment

Deploy this as a separate Vercel project pointing to `apps/public-results/`.

In Vercel project settings:

- **Root Directory**: `apps/public-results`
- **Framework**: Next.js

Set the same `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as the main app.

## Architecture

```
src/
  app/
    page.tsx              ← Event picker (home)
    layout.tsx            ← Shared header/footer
    not-found.tsx         ← 404 page
    e/[slug]/
      page.tsx            ← Event detail: standings, results, live
  lib/
    supabase.ts           ← Supabase client (anon, read-only)
    data.ts               ← Data fetching + computeStandings()
```

All pages use Next.js ISR (Incremental Static Regeneration):

- Home page: revalidates every 60 seconds
- Event pages: revalidates every 30 seconds

This means pages are served from edge cache with automatic background refreshes — no need for client-side polling.
