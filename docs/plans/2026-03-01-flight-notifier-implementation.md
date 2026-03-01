# Flight Notifier Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web app that monitors Flightradar24's gRPC-Web API, detects when Schiphol runway 09 (Buitenveldertbaan) is active for landings, shows a live map of approaching planes, a timetable of upcoming arrivals, and sends browser push notifications.

**Architecture:** Express backend polls FR24 every 8 seconds via gRPC-Web, maintains in-memory flight state, detects runway 09 approaches (westbound heading, destination AMS, altitude <3000ft), and pushes events to the React frontend via SSE. Frontend renders a Leaflet map with live plane positions, a status banner, flight list, and timetable.

**Tech Stack:** TypeScript, Express, React 19, Vite (rolldown), Tailwind CSS 4, shadcn/ui, Leaflet + react-leaflet, protobufjs, SSE, Browser Notification API.

**Reference:** Design doc at `docs/plans/2026-03-01-flight-notifier-design.md`

**Reference:** FR24 API research was done live in Chrome DevTools. Key findings:
- Endpoint: `POST https://data-feed.flightradar24.com/fr24.feed.api.v1.Feed/LiveFeed`
- Protocol: gRPC-Web with protobuf (content-type: `application/grpc-web+proto`)
- Headers: `x-grpc-web: 1`, `fr24-platform: web-26.056.1412`, `fr24-device-id: web-<random>`
- Request: bounding box + settings (sources 0-10, services 0-11, trafficType 3) + fieldMask (max 4: flight,reg,route,type) + limit + maxage
- Response: array of Flight { flightId, callsign, lat, lon, alt, speed, track, onGround, source, timestamp, extraInfo: { type, reg, flight, route: { from, to } } }
- No auth required. Binary protobuf encoding. gRPC-Web frame = 1 byte flag (0) + 4 bytes big-endian length + payload.
- Also available: `FlightDetails` (by flightId), `NearestFlights` (by lat/lon/radius)

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.server.json`
- Create: `tsconfig.client.json`
- Create: `client/vite.config.ts`
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `client/src/index.css`
- Create: `client/postcss.config.js`
- Create: `client/tailwind.config.ts`
- Create: `client/components.json`
- Create: `server/server.ts`
- Create: `.prettierrc.json`
- Create: `CLAUDE.md`
- Create: `.gitignore`

**Step 1: Create package.json**

```json
{
  "name": "flight-notifier",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "NODE_ENV=development tsx watch --tsconfig ./tsconfig.server.json ./server/server.ts",
    "build:client": "tsc -b tsconfig.client.json && vite build --config client/vite.config.ts",
    "build:server": "tsc -b tsconfig.server.json",
    "build": "npm run build:server && npm run build:client",
    "start": "NODE_ENV=production node ./dist/server/server.js",
    "typecheck": "tsc -p ./tsconfig.server.json --noEmit && tsc -p ./tsconfig.client.json --noEmit"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.90.20",
    "@types/express": "^5.0.5",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "express": "^5.1.0",
    "leaflet": "^1.9.4",
    "lucide-react": "^0.511.0",
    "protobufjs": "^7.4.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-leaflet": "^5.0.0",
    "tailwind-merge": "^3.3.1",
    "tailwindcss-animate": "^1.0.7"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.17",
    "@tailwindcss/vite": "^4.1.17",
    "@types/leaflet": "^1.9.21",
    "@types/node": "^24.6.0",
    "@types/react": "^19.1.16",
    "@types/react-dom": "^19.1.9",
    "@vitejs/plugin-react": "^5.0.4",
    "autoprefixer": "^10.4.21",
    "prettier": "^3.6.2",
    "tailwindcss": "^4.0.14",
    "tsx": "^4.20.6",
    "typescript": "~5.9.3",
    "vite": "npm:rolldown-vite@7.1.14"
  },
  "overrides": {
    "vite": "npm:rolldown-vite@7.1.14"
  }
}
```

**Step 2: Create TypeScript configs**

`tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.client.json" },
    { "path": "./tsconfig.server.json" }
  ]
}
```

`tsconfig.server.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": ".",
    "declaration": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["server/**/*"]
}
```

`tsconfig.client.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "paths": {
      "@/*": ["./client/src/*"]
    },
    "types": ["vite/client"]
  },
  "include": ["client/src/**/*"]
}
```

**Step 3: Create Vite config**

`client/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: path.resolve(__dirname, './dist'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

**Step 4: Create client entry files**

`client/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Flight Notifier - Schiphol Runway 09</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

`client/src/main.tsx`:
```typescript
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
```

`client/src/App.tsx`:
```typescript
export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <h1 className="text-2xl font-bold p-4">Flight Notifier</h1>
      <p className="px-4 text-muted-foreground">Loading...</p>
    </div>
  );
}
```

`client/src/index.css`:
```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.714);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.145 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.145 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.396 0.141 25.723);
  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.269 0 0);
  --sidebar-ring: oklch(0.556 0 0);
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

`client/postcss.config.js`:
```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};
```

`client/tailwind.config.ts`:
```typescript
import tailwindcssAnimate from 'tailwindcss-animate';
const config = {
  darkMode: ['class', 'media'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  plugins: [tailwindcssAnimate],
};
export default config;
```

`client/components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

**Step 5: Create minimal Express server**

`server/server.ts`:
```typescript
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// API routes placeholder
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// In production, serve the built client
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Flight Notifier server running on http://localhost:${PORT}`);
});
```

**Step 6: Create supporting config files**

`.prettierrc.json`:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 120,
  "tabWidth": 2,
  "bracketSpacing": true,
  "endOfLine": "lf"
}
```

`.gitignore`:
```
node_modules/
dist/
client/dist/
*.log
.env
```

`CLAUDE.md`:
```markdown
# Flight Notifier

## Overview
Web app monitoring Flightradar24 to detect Schiphol runway 09 (Buitenveldertbaan) landings.
Sends browser push notifications and shows a live map + timetable.

## Tech Stack
- **Backend**: Express + TypeScript (tsx for dev)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Map**: Leaflet + react-leaflet + OpenStreetMap
- **Real-time**: SSE (Server-Sent Events)
- **Data source**: FR24 gRPC-Web API (protobufjs for encoding)
- **No database** - all state is in-memory

## Commands
- `npm run dev` — start dev server (tsx watch, port 3000)
- `npm run build` — build server + client for production
- `npm start` — run production build
- `npm run typecheck` — type-check both server and client

## Project Structure
- `server/` — Express server, FR24 poller, flight state
- `client/src/` — React frontend
- `client/src/components/` — UI components (map, status, timetable)
- `client/src/hooks/` — Custom hooks (SSE events)

## Key Concepts
- Server polls FR24 LiveFeed gRPC-Web endpoint every 8 seconds
- Detects runway 09 approach: destination=AMS, heading 250-290, alt<3000ft, airborne
- Pushes flight events to browser via SSE at GET /api/events
- Browser shows notifications via Notification API
```

**Step 7: Install dependencies and verify**

Run: `cd /Users/andraskauer/Workspaces/flightnotifier && npm install`
Expected: Dependencies install successfully.

Run: `npm run typecheck`
Expected: No type errors.

Run: `npm run dev` (test briefly, then stop)
Expected: Server starts on port 3000, /api/health returns OK.

**Step 8: Install shadcn/ui utility**

Create `client/src/lib/utils.ts`:
```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold project with Express, React, Vite, Tailwind, shadcn/ui"
```

---

## Task 2: Protobuf Encoder/Decoder for FR24 gRPC-Web

**Files:**
- Create: `server/fr24/proto.ts`

This is the core layer that constructs and parses the binary protobuf messages for FR24's gRPC-Web API. We encode protobuf manually using `protobufjs` since we don't have .proto files — we reverse-engineered the schema from the browser.

**Step 1: Create proto.ts with types and encoder/decoder**

`server/fr24/proto.ts`:
```typescript
import protobuf from 'protobufjs';

// --- Types ---

export interface LiveFeedFlight {
  flightId: number;
  callsign: string;
  lat: number;
  lon: number;
  alt: number;
  speed: number;
  track: number;
  onGround: boolean;
  source: number;
  timestamp: number;
  extraInfo?: {
    type?: string;
    reg?: string;
    flight?: string;
    route?: { from?: string; to?: string };
  };
}

export interface LiveFeedResponse {
  flights: LiveFeedFlight[];
  serverTimeMs?: number;
}

// --- Protobuf Schema (reverse-engineered from FR24 web app) ---

// Field numbers determined by analyzing the binary protobuf data:
// LiveFeedRequest:
//   1: bounds (LocationBoundaries)
//   2: settings (VisibilitySettings)
//   4: highlightMode (int32)
//   5: limit (int32)
//   6: maxage (int32)
//   7: restrictionMode (int32)
//   8: fieldMask (FieldMask)
//   9: fleetsList (repeated string)
//   10: filtersList (repeated Filter)
//   11: selectedFlightIdsList (repeated uint32)
//   12: stats (bool)
//
// LocationBoundaries:
//   1: north (float)
//   2: south (float)
//   3: west (float)
//   4: east (float)
//
// VisibilitySettings:
//   1: sourcesList (repeated int32)
//   2: servicesList (repeated int32)
//   3: trafficType (int32)
//   4: onlyRestricted (bool)
//
// FieldMask:
//   1: pathsList (repeated string)
//
// LiveFeedResponse:
//   1: flightsList (repeated Flight)
//   2: stats
//   3: selectedFlightsList
//   4: serverTimeMs (int64)
//
// Flight:
//   1: flightId (uint32)
//   2: lat (float)
//   3: lon (float)
//   4: track (int32)
//   5: alt (int32)
//   6: speed (int32)
//   7: icon (enum)
//   8: status (int32)
//   9: timestamp (int32)
//   10: onGround (bool)
//   11: callsign (string)
//   12: source (int32)
//   13: extraInfo (ExtraFlightInfo)
//   14: positionBuffer
//   15: timestampMs (int64)
//
// ExtraFlightInfo:
//   1: flight (string)
//   2: reg (string)
//   3: route (Route)
//   4: type (string)
//   5: squawk (int32)
//   6-18: various other fields
//
// Route:
//   1: from (string)
//   2: to (string)

const root = protobuf.Root.fromJSON({
  nested: {
    LocationBoundaries: {
      fields: {
        north: { type: 'float', id: 1 },
        south: { type: 'float', id: 2 },
        west: { type: 'float', id: 3 },
        east: { type: 'float', id: 4 },
      },
    },
    VisibilitySettings: {
      fields: {
        sourcesList: { type: 'int32', id: 1, rule: 'repeated', options: { packed: true } },
        servicesList: { type: 'int32', id: 2, rule: 'repeated', options: { packed: true } },
        trafficType: { type: 'int32', id: 3 },
        onlyRestricted: { type: 'bool', id: 4 },
      },
    },
    FieldMask: {
      fields: {
        pathsList: { type: 'string', id: 1, rule: 'repeated' },
      },
    },
    LiveFeedRequest: {
      fields: {
        bounds: { type: 'LocationBoundaries', id: 1 },
        settings: { type: 'VisibilitySettings', id: 2 },
        limit: { type: 'int32', id: 5 },
        maxage: { type: 'int32', id: 6 },
        restrictionMode: { type: 'int32', id: 7 },
        fieldMask: { type: 'FieldMask', id: 8 },
      },
    },
    Route: {
      fields: {
        from: { type: 'string', id: 1 },
        to: { type: 'string', id: 2 },
      },
    },
    ExtraFlightInfo: {
      fields: {
        flight: { type: 'string', id: 1 },
        reg: { type: 'string', id: 2 },
        route: { type: 'Route', id: 3 },
        type: { type: 'string', id: 4 },
        squawk: { type: 'int32', id: 5 },
      },
    },
    Flight: {
      fields: {
        flightId: { type: 'uint32', id: 1 },
        lat: { type: 'float', id: 2 },
        lon: { type: 'float', id: 3 },
        track: { type: 'int32', id: 4 },
        alt: { type: 'int32', id: 5 },
        speed: { type: 'int32', id: 6 },
        icon: { type: 'int32', id: 7 },
        status: { type: 'int32', id: 8 },
        timestamp: { type: 'int32', id: 9 },
        onGround: { type: 'bool', id: 10 },
        callsign: { type: 'string', id: 11 },
        source: { type: 'int32', id: 12 },
        extraInfo: { type: 'ExtraFlightInfo', id: 13 },
      },
    },
    LiveFeedResponse: {
      fields: {
        flightsList: { type: 'Flight', id: 1, rule: 'repeated' },
        serverTimeMs: { type: 'int64', id: 4 },
      },
    },
  },
});

const LiveFeedRequestType = root.lookupType('LiveFeedRequest');
const LiveFeedResponseType = root.lookupType('LiveFeedResponse');

// --- Encoding ---

export interface BoundingBox {
  north: number;
  south: number;
  west: number;
  east: number;
}

export function encodeLiveFeedRequest(bounds: BoundingBox, limit = 1500, maxage = 14400): Uint8Array {
  const message = LiveFeedRequestType.create({
    bounds: { north: bounds.north, south: bounds.south, west: bounds.west, east: bounds.east },
    settings: {
      sourcesList: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      servicesList: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      trafficType: 3, // ALL
      onlyRestricted: false,
    },
    fieldMask: { pathsList: ['flight', 'reg', 'route', 'type'] },
    limit,
    maxage,
    restrictionMode: 0,
  });

  const payload = LiveFeedRequestType.encode(message).finish();

  // Wrap in gRPC-Web frame: 1 byte flag (0=no compression) + 4 bytes big-endian length + payload
  const frame = new Uint8Array(5 + payload.length);
  frame[0] = 0;
  frame[1] = (payload.length >> 24) & 0xff;
  frame[2] = (payload.length >> 16) & 0xff;
  frame[3] = (payload.length >> 8) & 0xff;
  frame[4] = payload.length & 0xff;
  frame.set(payload, 5);

  return frame;
}

// --- Decoding ---

export function decodeLiveFeedResponse(responseBytes: Uint8Array): LiveFeedResponse {
  if (responseBytes.length < 5) {
    return { flights: [] };
  }

  // Parse gRPC-Web frame: skip 5-byte header (1 flag + 4 length)
  const dataLen = (responseBytes[1] << 24) | (responseBytes[2] << 16) | (responseBytes[3] << 8) | responseBytes[4];

  if (dataLen === 0 || dataLen + 5 > responseBytes.length) {
    return { flights: [] };
  }

  const payload = responseBytes.slice(5, 5 + dataLen);
  const decoded = LiveFeedResponseType.decode(payload) as unknown as {
    flightsList: Array<{
      flightId: number;
      lat: number;
      lon: number;
      track: number;
      alt: number;
      speed: number;
      timestamp: number;
      onGround: boolean;
      callsign: string;
      source: number;
      extraInfo?: {
        flight?: string;
        reg?: string;
        route?: { from?: string; to?: string };
        type?: string;
      };
    }>;
    serverTimeMs?: { low: number; high: number } | number;
  };

  const flights: LiveFeedFlight[] = (decoded.flightsList || []).map((f) => ({
    flightId: f.flightId,
    callsign: f.callsign || '',
    lat: f.lat,
    lon: f.lon,
    alt: f.alt || 0,
    speed: f.speed || 0,
    track: f.track || 0,
    onGround: f.onGround || false,
    source: f.source || 0,
    timestamp: f.timestamp || 0,
    extraInfo: f.extraInfo
      ? {
          type: f.extraInfo.type,
          reg: f.extraInfo.reg,
          flight: f.extraInfo.flight,
          route: f.extraInfo.route ? { from: f.extraInfo.route.from, to: f.extraInfo.route.to } : undefined,
        }
      : undefined,
  }));

  return { flights };
}
```

**Step 2: Verify types compile**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add server/fr24/proto.ts
git commit -m "feat: add protobuf encoder/decoder for FR24 gRPC-Web LiveFeed"
```

---

## Task 3: FR24 Poller Service

**Files:**
- Create: `server/fr24/poller.ts`

**Step 1: Create poller.ts**

`server/fr24/poller.ts`:
```typescript
import { encodeLiveFeedRequest, decodeLiveFeedResponse, type BoundingBox, type LiveFeedFlight } from './proto.js';

const FR24_ENDPOINT = 'https://data-feed.flightradar24.com/fr24.feed.api.v1.Feed/LiveFeed';
const POLL_INTERVAL_MS = 8000;
const DEVICE_ID = `web-flightnotifier-${Math.random().toString(36).slice(2, 10)}`;

export type FlightUpdateCallback = (flights: LiveFeedFlight[]) => void;

export class FR24Poller {
  private bounds: BoundingBox;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onUpdate: FlightUpdateCallback;

  constructor(bounds: BoundingBox, onUpdate: FlightUpdateCallback) {
    this.bounds = bounds;
    this.onUpdate = onUpdate;
  }

  start(): void {
    console.log('[FR24 Poller] Starting, polling every', POLL_INTERVAL_MS / 1000, 'seconds');
    this.poll(); // immediate first poll
    this.intervalId = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[FR24 Poller] Stopped');
    }
  }

  private async poll(): Promise<void> {
    try {
      const body = encodeLiveFeedRequest(this.bounds);

      const response = await fetch(FR24_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/grpc-web+proto',
          'x-grpc-web': '1',
          'x-user-agent': 'grpc-web-javascript/0.1',
          'fr24-platform': 'web-26.056.1412',
          'fr24-device-id': DEVICE_ID,
          'accept-encoding': 'identity',
          'x-envoy-retry-grpc-on': 'unavailable',
        },
        body,
      });

      const grpcStatus = response.headers.get('grpc-status');
      if (grpcStatus && grpcStatus !== '0') {
        const msg = response.headers.get('grpc-message') || 'unknown';
        console.error(`[FR24 Poller] gRPC error ${grpcStatus}: ${msg}`);
        return;
      }

      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const result = decodeLiveFeedResponse(bytes);

      this.onUpdate(result.flights);
    } catch (error) {
      console.error('[FR24 Poller] Poll failed:', error);
    }
  }
}
```

**Step 2: Verify types**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add server/fr24/poller.ts
git commit -m "feat: add FR24 poller service with 8s gRPC-Web polling"
```

---

## Task 4: Runway 09 Detector + Flight State Manager

**Files:**
- Create: `server/fr24/detector.ts`
- Create: `server/state.ts`

**Step 1: Create detector.ts**

The detector checks if a flight is on the runway 09 approach: destination AMS, heading ~270 (250-290), altitude <3000ft, airborne.

`server/fr24/detector.ts`:
```typescript
import type { LiveFeedFlight } from './proto.js';

// Runway 09 Buitenveldertbaan approach: westbound, low altitude, destination AMS
const MIN_HEADING = 250;
const MAX_HEADING = 290;
const MAX_ALTITUDE_FT = 3000;

export function isOnRunway09Approach(flight: LiveFeedFlight): boolean {
  const dest = flight.extraInfo?.route?.to;
  if (dest !== 'AMS') return false;
  if (flight.onGround) return false;
  if (flight.alt > MAX_ALTITUDE_FT) return false;
  if (flight.alt <= 0) return false; // no altitude data
  if (flight.track < MIN_HEADING || flight.track > MAX_HEADING) return false;
  return true;
}
```

**Step 2: Create state.ts**

`server/state.ts`:
```typescript
import type { LiveFeedFlight } from './fr24/proto.js';
import { isOnRunway09Approach } from './fr24/detector.js';

export interface FlightState {
  allFlights: LiveFeedFlight[];
  approachingFlights: LiveFeedFlight[];
  runway09Active: boolean;
  lastUpdateMs: number;
}

export type StateChangeEvent =
  | { type: 'flights_updated'; state: FlightState }
  | { type: 'runway09_activated'; flights: LiveFeedFlight[] }
  | { type: 'runway09_deactivated' }
  | { type: 'new_approach'; flight: LiveFeedFlight };

export type EventCallback = (event: StateChangeEvent) => void;

const RUNWAY_INACTIVE_TIMEOUT_MS = 120_000; // 2 minutes with no approach flights → inactive

export class FlightStateManager {
  private state: FlightState = {
    allFlights: [],
    approachingFlights: [],
    runway09Active: false,
    lastUpdateMs: 0,
  };

  private lastApproachTime = 0;
  private knownApproachFlightIds = new Set<number>();
  private listeners: EventCallback[] = [];

  onEvent(callback: EventCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  getState(): FlightState {
    return { ...this.state };
  }

  update(flights: LiveFeedFlight[]): void {
    const approaching = flights.filter(isOnRunway09Approach);
    const now = Date.now();

    // Detect new approach flights
    for (const flight of approaching) {
      if (!this.knownApproachFlightIds.has(flight.flightId)) {
        this.knownApproachFlightIds.add(flight.flightId);
        this.emit({ type: 'new_approach', flight });
      }
    }

    // Clean up old flight IDs (keep only currently visible ones)
    const currentIds = new Set(approaching.map((f) => f.flightId));
    for (const id of this.knownApproachFlightIds) {
      if (!currentIds.has(id)) {
        this.knownApproachFlightIds.delete(id);
      }
    }

    // Update runway active state
    const wasActive = this.state.runway09Active;

    if (approaching.length > 0) {
      this.lastApproachTime = now;
    }

    const isActive = approaching.length > 0 || now - this.lastApproachTime < RUNWAY_INACTIVE_TIMEOUT_MS;

    this.state = {
      allFlights: flights,
      approachingFlights: approaching,
      runway09Active: isActive,
      lastUpdateMs: now,
    };

    // Emit state change events
    if (!wasActive && isActive) {
      this.emit({ type: 'runway09_activated', flights: approaching });
    } else if (wasActive && !isActive) {
      this.emit({ type: 'runway09_deactivated' });
    }

    this.emit({ type: 'flights_updated', state: this.getState() });
  }

  private emit(event: StateChangeEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
```

**Step 3: Verify types**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add server/fr24/detector.ts server/state.ts
git commit -m "feat: add runway 09 detector and flight state manager"
```

---

## Task 5: SSE Endpoint + Wire Up Server

**Files:**
- Modify: `server/server.ts`

**Step 1: Update server.ts to wire everything together**

Replace `server/server.ts` with:
```typescript
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FR24Poller } from './fr24/poller.js';
import { FlightStateManager, type StateChangeEvent } from './state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// No-cache for API
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// --- Flight State ---

const stateManager = new FlightStateManager();

// Bounding box covering the runway 09 approach path east of Schiphol
// This box covers the approach corridor from east Amsterdam to Schiphol
const APPROACH_BOUNDS = {
  north: 52.45,
  south: 52.2,
  west: 4.6,
  east: 5.1,
};

const poller = new FR24Poller(APPROACH_BOUNDS, (flights) => {
  stateManager.update(flights);
});

// --- SSE Endpoint ---

interface SSEClient {
  id: number;
  res: express.Response;
}

let sseClientId = 0;
const sseClients: SSEClient[] = [];

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const clientId = ++sseClientId;
  const client: SSEClient = { id: clientId, res };
  sseClients.push(client);

  // Send current state immediately
  const state = stateManager.getState();
  res.write(`data: ${JSON.stringify({ type: 'flights_updated', state })}\n\n`);

  req.on('close', () => {
    const idx = sseClients.findIndex((c) => c.id === clientId);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

function broadcastSSE(event: StateChangeEvent): void {
  const data = JSON.stringify(event);
  for (const client of sseClients) {
    client.res.write(`data: ${data}\n\n`);
  }
}

stateManager.onEvent(broadcastSSE);

// --- REST API ---

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/state', (_req, res) => {
  res.json(stateManager.getState());
});

// --- Static files (production) ---

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// --- Start ---

app.listen(PORT, () => {
  console.log(`Flight Notifier running on http://localhost:${PORT}`);
  poller.start();
});
```

**Step 2: Verify types**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: No errors.

**Step 3: Test the server manually**

Run: `npm run dev`
Expected: Server starts, begins polling FR24, logs flight counts.
Test: `curl http://localhost:3000/api/state` returns JSON with flights.
Test: `curl -N http://localhost:3000/api/events` returns SSE stream.

**Step 4: Commit**

```bash
git add server/server.ts
git commit -m "feat: wire up SSE endpoint, poller, and state manager in server"
```

---

## Task 6: SSE Hook + Status Banner Component

**Files:**
- Create: `client/src/hooks/useFlightEvents.ts`
- Create: `client/src/types.ts`
- Create: `client/src/components/StatusBanner.tsx`
- Modify: `client/src/App.tsx`

**Step 1: Create shared types**

`client/src/types.ts`:
```typescript
export interface LiveFeedFlight {
  flightId: number;
  callsign: string;
  lat: number;
  lon: number;
  alt: number;
  speed: number;
  track: number;
  onGround: boolean;
  source: number;
  timestamp: number;
  extraInfo?: {
    type?: string;
    reg?: string;
    flight?: string;
    route?: { from?: string; to?: string };
  };
}

export interface FlightState {
  allFlights: LiveFeedFlight[];
  approachingFlights: LiveFeedFlight[];
  runway09Active: boolean;
  lastUpdateMs: number;
}

export type StateChangeEvent =
  | { type: 'flights_updated'; state: FlightState }
  | { type: 'runway09_activated'; flights: LiveFeedFlight[] }
  | { type: 'runway09_deactivated' }
  | { type: 'new_approach'; flight: LiveFeedFlight };
```

**Step 2: Create SSE hook**

`client/src/hooks/useFlightEvents.ts`:
```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import type { FlightState, StateChangeEvent } from '../types';

const INITIAL_STATE: FlightState = {
  allFlights: [],
  approachingFlights: [],
  runway09Active: false,
  lastUpdateMs: 0,
};

export function useFlightEvents() {
  const [state, setState] = useState<FlightState>(INITIAL_STATE);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const es = new EventSource('/api/events');
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (event) => {
      const data = JSON.parse(event.data) as StateChangeEvent;

      switch (data.type) {
        case 'flights_updated':
          setState(data.state);
          break;
        case 'runway09_activated':
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Runway 09 Active!', {
              body: `${data.flights.length} plane(s) on approach over your area`,
              icon: '/plane-icon.png',
            });
          }
          break;
        case 'new_approach':
          if ('Notification' in window && Notification.permission === 'granted') {
            const f = data.flight;
            new Notification(`${f.extraInfo?.flight || f.callsign}`, {
              body: `${f.extraInfo?.type || 'Aircraft'} from ${f.extraInfo?.route?.from || '?'} · ${f.alt}ft`,
            });
          }
          break;
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, []);

  return { state, connected, requestNotificationPermission };
}
```

**Step 3: Create StatusBanner component**

`client/src/components/StatusBanner.tsx`:
```typescript
import type { FlightState } from '../types';

interface StatusBannerProps {
  state: FlightState;
  connected: boolean;
  onEnableNotifications: () => void;
}

export function StatusBanner({ state, connected, onEnableNotifications }: StatusBannerProps) {
  const notificationsSupported = 'Notification' in window;
  const notificationsGranted = notificationsSupported && Notification.permission === 'granted';

  return (
    <div className="border-b">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />

          {/* Runway status */}
          <div
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              state.runway09Active
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {state.runway09Active
              ? `RWY 09 ACTIVE (${state.approachingFlights.length} on approach)`
              : 'RWY 09 Inactive'}
          </div>

          {/* Flight count */}
          <span className="text-sm text-muted-foreground">{state.allFlights.length} flights tracked</span>
        </div>

        <div className="flex items-center gap-2">
          {notificationsSupported && !notificationsGranted && (
            <button
              onClick={onEnableNotifications}
              className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Enable Notifications
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Update App.tsx**

`client/src/App.tsx`:
```typescript
import { useFlightEvents } from './hooks/useFlightEvents';
import { StatusBanner } from './components/StatusBanner';

export default function App() {
  const { state, connected, requestNotificationPermission } = useFlightEvents();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b px-4 py-3">
        <h1 className="text-xl font-bold">Flight Notifier</h1>
        <p className="text-sm text-muted-foreground">Schiphol Runway 09 Buitenveldertbaan</p>
      </header>

      <StatusBanner state={state} connected={connected} onEnableNotifications={requestNotificationPermission} />

      <main className="flex-1 p-4">
        <p className="text-muted-foreground">Map and flight list coming next...</p>
      </main>
    </div>
  );
}
```

**Step 5: Verify types and test in browser**

Run: `npx tsc -p tsconfig.client.json --noEmit`
Expected: No errors.

Run: `npm run dev`, open browser at localhost:5173 (Vite dev port).
Expected: Status banner shows, SSE connects, flights update live.

**Step 6: Commit**

```bash
git add client/src/types.ts client/src/hooks/useFlightEvents.ts client/src/components/StatusBanner.tsx client/src/App.tsx
git commit -m "feat: add SSE hook, status banner, and notification support"
```

---

## Task 7: Leaflet Map Component

**Files:**
- Create: `client/src/components/FlightMap.tsx`
- Modify: `client/src/App.tsx`

**Step 1: Create FlightMap.tsx**

`client/src/components/FlightMap.tsx`:
```typescript
import { MapContainer, TileLayer, Marker, Popup, Polyline, Rectangle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';
import type { FlightState, LiveFeedFlight } from '../types';

// Schiphol coordinates
const SCHIPHOL = { lat: 52.3105, lng: 4.7683 };

// Approach bounding box (matches server APPROACH_BOUNDS)
const APPROACH_BOUNDS: L.LatLngBoundsExpression = [
  [52.2, 4.6],
  [52.45, 5.1],
];

// Runway 09 approach path (approximate centerline extending east)
const APPROACH_PATH: L.LatLngExpression[] = [
  [52.31, 4.77], // threshold
  [52.31, 4.9],
  [52.31, 5.05],
  [52.32, 5.2],
];

// Create a rotated plane icon
function createPlaneIcon(track: number, isApproaching: boolean): L.DivIcon {
  const color = isApproaching ? '#22c55e' : '#3b82f6';
  return L.divIcon({
    html: `<div style="transform: rotate(${track}deg); color: ${color}; font-size: 20px; line-height: 1;">&#9992;</div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function FlightMarker({ flight, isApproaching }: { flight: LiveFeedFlight; isApproaching: boolean }) {
  const icon = createPlaneIcon(flight.track, isApproaching);
  const label = flight.extraInfo?.flight || flight.callsign;
  const origin = flight.extraInfo?.route?.from || '?';
  const type = flight.extraInfo?.type || '?';

  return (
    <Marker position={[flight.lat, flight.lon]} icon={icon}>
      <Popup>
        <div className="text-sm">
          <div className="font-bold">{label}</div>
          <div>
            {type} · {flight.extraInfo?.reg}
          </div>
          <div>
            From: {origin} → AMS
          </div>
          <div>
            Alt: {flight.alt}ft · Spd: {flight.speed}kts · Hdg: {flight.track}°
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

// Component to fit the map to bounds on first load
function FitBounds() {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(APPROACH_BOUNDS, { padding: [20, 20] });
  }, [map]);
  return null;
}

interface FlightMapProps {
  state: FlightState;
}

export function FlightMap({ state }: FlightMapProps) {
  const approachIds = new Set(state.approachingFlights.map((f) => f.flightId));

  return (
    <MapContainer
      center={[SCHIPHOL.lat, SCHIPHOL.lng]}
      zoom={11}
      style={{ height: '100%', width: '100%' }}
      className="rounded-lg border"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBounds />

      {/* Approach corridor rectangle */}
      <Rectangle bounds={APPROACH_BOUNDS} pathOptions={{ color: '#6366f1', weight: 1, fillOpacity: 0.05 }} />

      {/* Approach path centerline */}
      <Polyline positions={APPROACH_PATH} pathOptions={{ color: '#22c55e', weight: 2, dashArray: '8 4' }} />

      {/* Schiphol marker */}
      <Marker position={[SCHIPHOL.lat, SCHIPHOL.lng]}>
        <Popup>Amsterdam Schiphol (AMS)</Popup>
      </Marker>

      {/* Flight markers */}
      {state.allFlights
        .filter((f) => !f.onGround)
        .map((flight) => (
          <FlightMarker key={flight.flightId} flight={flight} isApproaching={approachIds.has(flight.flightId)} />
        ))}
    </MapContainer>
  );
}
```

**Step 2: Update App.tsx to include the map**

`client/src/App.tsx`:
```typescript
import { useFlightEvents } from './hooks/useFlightEvents';
import { StatusBanner } from './components/StatusBanner';
import { FlightMap } from './components/FlightMap';

export default function App() {
  const { state, connected, requestNotificationPermission } = useFlightEvents();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b px-4 py-3">
        <h1 className="text-xl font-bold">Flight Notifier</h1>
        <p className="text-sm text-muted-foreground">Schiphol Runway 09 Buitenveldertbaan</p>
      </header>

      <StatusBanner state={state} connected={connected} onEnableNotifications={requestNotificationPermission} />

      <main className="flex flex-1 flex-col gap-4 p-4">
        {/* Map */}
        <div className="h-[500px] w-full">
          <FlightMap state={state} />
        </div>
      </main>
    </div>
  );
}
```

**Step 3: Verify and test**

Run: `npx tsc -p tsconfig.client.json --noEmit`
Expected: No errors.

Open browser: Map should show with planes, approach corridor, and Schiphol marker.

**Step 4: Commit**

```bash
git add client/src/components/FlightMap.tsx client/src/App.tsx
git commit -m "feat: add Leaflet map with live plane positions and approach corridor"
```

---

## Task 8: Flight List Component

**Files:**
- Create: `client/src/components/FlightList.tsx`
- Modify: `client/src/App.tsx`

**Step 1: Create FlightList.tsx**

`client/src/components/FlightList.tsx`:
```typescript
import type { LiveFeedFlight } from '../types';

interface FlightListProps {
  flights: LiveFeedFlight[];
  approachingIds: Set<number>;
}

export function FlightList({ flights, approachingIds }: FlightListProps) {
  const airborne = flights.filter((f) => !f.onGround).sort((a, b) => a.alt - b.alt);

  if (airborne.length === 0) {
    return <p className="text-sm text-muted-foreground">No airborne flights in the area.</p>;
  }

  return (
    <div className="overflow-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Flight</th>
            <th className="px-3 py-2 text-left font-medium">Callsign</th>
            <th className="px-3 py-2 text-left font-medium">Type</th>
            <th className="px-3 py-2 text-left font-medium">Origin</th>
            <th className="px-3 py-2 text-right font-medium">Alt (ft)</th>
            <th className="px-3 py-2 text-right font-medium">Speed (kts)</th>
            <th className="px-3 py-2 text-right font-medium">Heading</th>
          </tr>
        </thead>
        <tbody>
          {airborne.map((f) => {
            const isApproaching = approachingIds.has(f.flightId);
            return (
              <tr
                key={f.flightId}
                className={`border-t ${isApproaching ? 'bg-green-50 dark:bg-green-950' : ''}`}
              >
                <td className="px-3 py-2 font-mono font-semibold">
                  {isApproaching && <span className="mr-1">&#9992;</span>}
                  {f.extraInfo?.flight || '-'}
                </td>
                <td className="px-3 py-2 font-mono">{f.callsign}</td>
                <td className="px-3 py-2">{f.extraInfo?.type || '-'}</td>
                <td className="px-3 py-2">{f.extraInfo?.route?.from || '-'}</td>
                <td className="px-3 py-2 text-right font-mono">{f.alt.toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-mono">{f.speed}</td>
                <td className="px-3 py-2 text-right font-mono">{f.track}°</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 2: Add FlightList to App.tsx**

Update `client/src/App.tsx` main section:
```typescript
import { useFlightEvents } from './hooks/useFlightEvents';
import { StatusBanner } from './components/StatusBanner';
import { FlightMap } from './components/FlightMap';
import { FlightList } from './components/FlightList';
import { useMemo } from 'react';

export default function App() {
  const { state, connected, requestNotificationPermission } = useFlightEvents();
  const approachingIds = useMemo(
    () => new Set(state.approachingFlights.map((f) => f.flightId)),
    [state.approachingFlights]
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b px-4 py-3">
        <h1 className="text-xl font-bold">Flight Notifier</h1>
        <p className="text-sm text-muted-foreground">Schiphol Runway 09 Buitenveldertbaan</p>
      </header>

      <StatusBanner state={state} connected={connected} onEnableNotifications={requestNotificationPermission} />

      <main className="flex flex-1 flex-col gap-4 p-4">
        <div className="h-[500px] w-full">
          <FlightMap state={state} />
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">Airborne Flights</h2>
          <FlightList flights={state.allFlights} approachingIds={approachingIds} />
        </div>
      </main>
    </div>
  );
}
```

**Step 3: Verify and test**

Run: `npx tsc -p tsconfig.client.json --noEmit`
Expected: No errors.

Open browser: Flight table shows below map with approaching flights highlighted green.

**Step 4: Commit**

```bash
git add client/src/components/FlightList.tsx client/src/App.tsx
git commit -m "feat: add flight list table with approach highlighting"
```

---

## Task 9: Timetable (Upcoming AMS Arrivals)

**Files:**
- Create: `server/fr24/schedule.ts`
- Create: `client/src/components/Timetable.tsx`
- Modify: `server/server.ts`
- Modify: `client/src/App.tsx`

**Step 1: Create schedule.ts — fetch upcoming AMS arrivals from FR24**

FR24 has a public airport arrivals page. We use the FlightDetails data we already have plus the LiveFeed data to build a schedule. The simplest approach: take all AMS-destined flights from the LiveFeed that are airborne, compute ETA based on distance/speed, and present as a timetable.

`server/fr24/schedule.ts`:
```typescript
import type { LiveFeedFlight } from './proto.js';

export interface ScheduledArrival {
  flightId: number;
  flightNumber: string;
  callsign: string;
  origin: string;
  aircraftType: string;
  registration: string;
  altitude: number;
  speed: number;
  distanceToAmsKm: number;
  estimatedMinutes: number;
  isOnRunway09: boolean;
}

const SCHIPHOL_LAT = 52.3105;
const SCHIPHOL_LON = 4.7683;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function buildSchedule(flights: LiveFeedFlight[], approachingIds: Set<number>): ScheduledArrival[] {
  return flights
    .filter((f) => f.extraInfo?.route?.to === 'AMS' && !f.onGround && f.speed > 0)
    .map((f) => {
      const distKm = haversineKm(f.lat, f.lon, SCHIPHOL_LAT, SCHIPHOL_LON);
      const speedKmh = f.speed * 1.852; // knots to km/h
      const etaMinutes = speedKmh > 0 ? Math.round((distKm / speedKmh) * 60) : 999;

      return {
        flightId: f.flightId,
        flightNumber: f.extraInfo?.flight || '',
        callsign: f.callsign,
        origin: f.extraInfo?.route?.from || '?',
        aircraftType: f.extraInfo?.type || '?',
        registration: f.extraInfo?.reg || '',
        altitude: f.alt,
        speed: f.speed,
        distanceToAmsKm: Math.round(distKm),
        estimatedMinutes: etaMinutes,
        isOnRunway09: approachingIds.has(f.flightId),
      };
    })
    .sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);
}
```

**Step 2: Add /api/schedule endpoint to server.ts**

Add these lines to `server/server.ts` after the existing REST API section:

```typescript
import { buildSchedule } from './fr24/schedule.js';

// Add to REST API section:
app.get('/api/schedule', (_req, res) => {
  const state = stateManager.getState();
  const approachingIds = new Set(state.approachingFlights.map((f) => f.flightId));
  const schedule = buildSchedule(state.allFlights, approachingIds);
  res.json(schedule);
});
```

**Step 3: Create Timetable.tsx**

`client/src/components/Timetable.tsx`:
```typescript
import { useQuery } from '@tanstack/react-query';

interface ScheduledArrival {
  flightId: number;
  flightNumber: string;
  callsign: string;
  origin: string;
  aircraftType: string;
  registration: string;
  altitude: number;
  speed: number;
  distanceToAmsKm: number;
  estimatedMinutes: number;
  isOnRunway09: boolean;
}

export function Timetable() {
  const { data: schedule } = useQuery<ScheduledArrival[]>({
    queryKey: ['schedule'],
    queryFn: () => fetch('/api/schedule').then((r) => r.json()),
    refetchInterval: 10000,
  });

  if (!schedule || schedule.length === 0) {
    return <p className="text-sm text-muted-foreground">No inbound AMS arrivals detected.</p>;
  }

  return (
    <div className="overflow-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Flight</th>
            <th className="px-3 py-2 text-left font-medium">Origin</th>
            <th className="px-3 py-2 text-left font-medium">Type</th>
            <th className="px-3 py-2 text-right font-medium">Distance</th>
            <th className="px-3 py-2 text-right font-medium">ETA</th>
            <th className="px-3 py-2 text-center font-medium">RWY 09</th>
          </tr>
        </thead>
        <tbody>
          {schedule.map((a) => (
            <tr
              key={a.flightId}
              className={`border-t ${a.isOnRunway09 ? 'bg-green-50 dark:bg-green-950' : ''}`}
            >
              <td className="px-3 py-2 font-mono font-semibold">{a.flightNumber || a.callsign}</td>
              <td className="px-3 py-2">{a.origin}</td>
              <td className="px-3 py-2">{a.aircraftType}</td>
              <td className="px-3 py-2 text-right font-mono">{a.distanceToAmsKm} km</td>
              <td className="px-3 py-2 text-right font-mono">
                {a.estimatedMinutes < 60 ? `${a.estimatedMinutes} min` : `${Math.round(a.estimatedMinutes / 60)}h ${a.estimatedMinutes % 60}m`}
              </td>
              <td className="px-3 py-2 text-center">
                {a.isOnRunway09 ? <span className="text-green-600 font-bold">&#10003;</span> : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 4: Add Timetable to App.tsx**

Add the Timetable import and component below the FlightList in `client/src/App.tsx`:

```typescript
import { Timetable } from './components/Timetable';

// In the main section, after FlightList:
<div>
  <h2 className="mb-2 text-lg font-semibold">Upcoming AMS Arrivals</h2>
  <Timetable />
</div>
```

**Step 5: Verify and test**

Run: `npx tsc -p tsconfig.server.json --noEmit && npx tsc -p tsconfig.client.json --noEmit`
Expected: No errors.

Open browser: Timetable shows inbound flights sorted by ETA.

**Step 6: Commit**

```bash
git add server/fr24/schedule.ts server/server.ts client/src/components/Timetable.tsx client/src/App.tsx
git commit -m "feat: add timetable with upcoming AMS arrivals sorted by ETA"
```

---

## Task 10: Polish, Verify, and Final Commit

**Files:**
- Possibly adjust: any component based on browser testing

**Step 1: Run full typecheck**

Run: `npm run typecheck`
Expected: No errors in server or client.

**Step 2: Run the app end-to-end**

Run: `npm run dev`
Open browser at `http://localhost:5173`

Verify:
- Status banner shows runway state (active/inactive)
- Map loads with plane icons in correct positions
- Planes on runway 09 approach are highlighted green
- Flight list table shows airborne flights
- Timetable shows inbound flights with ETAs
- SSE connection indicator is green
- If runway 09 is active, notification fires (after clicking "Enable Notifications")

**Step 3: Use chrome-devtools MCP to verify UI**

Take a screenshot with the Chrome DevTools MCP tool to visually verify the layout looks correct.

**Step 4: Fix any issues found**

Address any visual or functional issues discovered during testing.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: flight notifier v1 - live map, runway 09 detection, notifications, timetable"
```
