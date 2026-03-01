# Flight Notifier - Design Document

## Problem

Planes landing at Amsterdam Schiphol sometimes use runway 09 (Buitenveldertbaan), which brings them on a westbound approach path over the user's balcony. This doesn't happen all the time - it depends on wind/weather conditions and ATC decisions. The user wants to know when runway 09 is active so they can watch the planes.

## Solution

A web app that monitors Flightradar24's live flight data, detects when runway 09 is in use for landings, and sends browser push notifications. It also shows a live map of approaching planes and a timetable of upcoming arrivals.

## Data Source

Flightradar24's internal gRPC-Web API (reverse-engineered):

- **Endpoint:** `POST https://data-feed.flightradar24.com/fr24.feed.api.v1.Feed/LiveFeed`
- **Protocol:** gRPC-Web with Protocol Buffers
- **Auth:** None required (public, unauthenticated)
- **Key headers:** `content-type: application/grpc-web+proto`, `x-grpc-web: 1`, `fr24-platform: web-26.056.1412`
- **Rate:** Poll every ~8 seconds (matches FR24's own refresh rate)

### Request: LiveFeedRequest

```
LiveFeedRequest {
  bounds: { north, south, east, west }  // bounding box (floats)
  settings: {
    sourcesList: [0..10]                // all data sources
    servicesList: [0..11]               // all service types
    trafficType: 3                      // ALL
  }
  fieldMask: { pathsList: ['flight', 'reg', 'route', 'type'] }  // max 4 fields
  limit: 100
  maxage: 14400
}
```

### Response: Flight object

```
Flight {
  flightId, callsign, lat, lon, alt, speed, track, onGround, source, timestamp,
  extraInfo: { type, reg, flight, route: { from, to } }
}
```

### Additional endpoints

- `FlightDetails` - full info for a specific flight (aircraft photos, schedule, gate, progress)
- `NearestFlights` - flights near a lat/lon with radius and distance
- `GET /mobile/airlines` - airline lookup data
- `GET /mobile/airports` - airport lookup data

## Detection Logic

### Runway 09 approach detection

Monitor a bounding box covering the approach path east of Schiphol. A flight is "on the 09 approach" when:

1. `route.to === "AMS"` (landing at Schiphol)
2. Heading (track) is roughly 250-290 degrees (westbound)
3. Altitude below ~3000ft (on final approach)
4. `onGround === false`
5. Position is within the monitoring bounding box

### Runway state

- **09 ACTIVE:** At least one flight matches the approach criteria
- **09 INACTIVE:** No matching flights for >2 minutes

## Architecture

```
Express Server (TypeScript)
├── FR24 Poller (8s interval) ──> gRPC-Web to data-feed.flightradar24.com
├── Flight State Manager (track flights, detect rwy 09, detect new arrivals)
├── SSE Endpoint: GET /api/events (push flight updates to browser)
└── REST: GET /api/schedule (upcoming AMS arrivals)

React Frontend (Vite + Tailwind + shadcn/ui)
├── Status Banner (Runway 09 active/inactive)
├── Live Map (Leaflet/OpenStreetMap with plane icons, approach path, monitoring zone)
├── Flight List (currently approaching flights)
├── Timetable (upcoming AMS arrivals)
└── Browser Push Notifications
```

No database - all state is in-memory.

## UI Layout

### Live View (main page)

1. **Status banner** - "Runway 09 ACTIVE" (green) or "Inactive" (gray)
2. **Map** - Leaflet with OSM tiles showing:
   - Schiphol airport marker
   - Runway 09 approach path line
   - Monitoring zone highlight
   - Live plane positions (icons with callsign labels)
   - Planes on the approach highlighted differently
3. **Flight list** - Table: callsign, flight number, origin, aircraft type, altitude, distance

### Timetable View

- Upcoming scheduled arrivals at AMS
- When runway 09 is active, arrivals are flagged as "likely overhead"
- Columns: flight number, origin, airline, scheduled arrival, aircraft type

### Notifications

- Browser Push Notification when runway 09 becomes active
- Optional: notification for each individual plane entering the zone

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Backend:** Express
- **Frontend:** React + Vite + Tailwind CSS + shadcn/ui
- **Map:** Leaflet + react-leaflet + OpenStreetMap tiles
- **Real-time:** Server-Sent Events (SSE)
- **gRPC-Web:** Manual protobuf construction (no codegen, build frames by hand)
- **Notifications:** Browser Notification API + Push API

## File Structure

```
flightnotifier/
├── server/
│   ├── server.ts              # Express server, SSE endpoint, static serving
│   ├── fr24/
│   │   ├── poller.ts          # Polls FR24 LiveFeed every 8s
│   │   ├── proto.ts           # Protobuf message construction/parsing
│   │   └── detector.ts        # Runway 09 approach detection logic
│   └── state.ts               # In-memory flight state manager
├── client/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── FlightMap.tsx   # Leaflet map with planes
│   │   │   ├── StatusBanner.tsx
│   │   │   ├── FlightList.tsx
│   │   │   └── Timetable.tsx
│   │   └── hooks/
│   │       └── useFlightEvents.ts  # SSE connection hook
│   ├── index.html
│   └── vite.config.ts
├── package.json
├── tsconfig.json
└── CLAUDE.md
```
