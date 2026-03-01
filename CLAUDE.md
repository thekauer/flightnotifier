# Flight Notifier

A web app that monitors Flightradar24 live flight data, detects when runway 09 (Buitenveldertbaan) at Amsterdam Schiphol is active for landings, and sends browser push notifications. Shows a live map of approaching planes and a timetable of upcoming arrivals.

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Backend:** Express
- **Frontend:** React 19 + Vite (rolldown-vite) + Tailwind CSS v4 + shadcn/ui
- **Map:** Leaflet + react-leaflet + OpenStreetMap tiles
- **Real-time:** Server-Sent Events (SSE)
- **Data Source:** Flightradar24 gRPC-Web API (protobufjs)
- **State:** In-memory (no database)

## Commands

```bash
npm run dev          # Start dev server (tsx watch)
npm run build        # Build server + client for production
npm start            # Run production build
npm run typecheck    # Type-check both server and client
```

## Project Structure

```
flightnotifier/
├── server/
│   └── server.ts              # Express server, SSE endpoint, static serving
├── client/
│   ├── index.html
│   ├── vite.config.ts
│   ├── components.json         # shadcn/ui config
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css           # Tailwind v4 + shadcn/ui theme
│       └── lib/
│           └── utils.ts        # cn() utility
├── docs/
│   └── plans/                  # Design & implementation docs
├── package.json
├── tsconfig.json               # Project references
├── tsconfig.server.json
├── tsconfig.client.json
└── CLAUDE.md
```

## Design Docs

- `docs/plans/2026-03-01-flight-notifier-design.md` - Architecture and data source details
- `docs/plans/2026-03-01-flight-notifier-implementation.md` - Step-by-step implementation plan
