# Flight Notifier

A web app that monitors OpenSky Network live flight data, detects when the Buitenveldertbaan at Amsterdam Schiphol is active for landings, and sends browser push notifications. Shows a live map with an approach cone and a timetable of upcoming arrivals.

## Data provider policy

- **OpenSky Network** — use only when **live aircraft position and state** are required (map, approach cone, Buitenveldertbaan detection, runway/visibility predictions tied to ADS-B).
- **Flighty** (HTML arrivals board for AMS) — **source of truth** for **Amsterdam arrival schedule**, published ETAs, and time-to-arrival used by `/api/schedule` (with OpenSky-only fallback if Flighty is unavailable).
- **ADSBDB / existing metadata path** — keep **aircraft type, manufacturer, registration, owner**, and route enrichment on the metadata provider already wired in the poller (not Flighty).

## Important Rules

- **useEffect requires permission**: Before adding any `useEffect` hook to any component — even in a subagent — you MUST inform the user and ask for permission. Treat `useEffect` as a dangerous operation. At minimum, tell the user that a `useEffect` was added and explain why.

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Next.js 15 (App Router + Turbopack)
- **Package Manager:** Bun
- **Frontend:** React 19 + Tailwind CSS v4 + shadcn/ui
- **Map:** Leaflet + react-leaflet + OpenStreetMap tiles
- **Real-time:** Server-Sent Events (SSE)
- **Data Sources:** OpenSky Network REST API (OAuth2) for live state; Flighty airport page for AMS arrival schedule (scraped server-side); ADSBDB for aircraft/route metadata
- **State:** In-memory (no database)

## Commands

```bash
bun run dev          # Start dev server (Next.js + Turbopack)
bun run build        # Build for production
bun run start        # Run production build
bun run typecheck    # Type-check
```

## Project Structure

```
flightnotifier/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Main page
│   ├── globals.css             # Tailwind v4 + shadcn/ui theme
│   └── api/
│       ├── health/route.ts
│       ├── state/route.ts
│       ├── schedule/route.ts
│       ├── cone/route.ts
│       └── events/route.ts     # SSE streaming endpoint
├── components/
│   ├── FlightList.tsx
│   ├── FlightMap.tsx           # Dynamic import wrapper (no SSR)
│   ├── FlightMapInner.tsx      # Leaflet map (client-only)
│   ├── StatusBanner.tsx
│   ├── Timetable.tsx
│   └── Providers.tsx           # QueryClientProvider wrapper
├── hooks/
│   └── useFlightEvents.ts      # SSE subscription hook
├── lib/
│   ├── utils.ts                # cn() utility
│   └── types.ts                # Shared Flight types
├── server/
│   ├── singleton.ts            # globalThis singleton for poller + state
│   ├── state.ts                # Flight state manager, event emitter
│   ├── arrivals/               # Flighty AMS arrivals (HTML parse + cache)
│   ├── http/
│   │   ├── controllers/        # Thin HTTP handlers (delegate to services)
│   │   └── services/           # Schedule and other API orchestration
│   └── opensky/
│       ├── client.ts           # OpenSky REST API client + OAuth2
│       ├── poller.ts           # Polling loop
│       ├── detector.ts         # Buitenveldertbaan approach detection
│       ├── schedule.ts         # OpenSky-derived schedule (fallback)
│       └── types.ts            # Flight type definitions
├── docs/
│   └── plans/                  # Design & implementation docs
├── components.json             # shadcn/ui config
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── package.json
└── CLAUDE.md
```

## Design Docs

- `docs/plans/2026-03-01-flight-notifier-design.md` - Architecture and data source details
- `docs/plans/2026-03-01-flight-notifier-implementation.md` - Step-by-step implementation plan
