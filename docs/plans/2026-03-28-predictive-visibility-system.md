# Predictive Visibility System — Design Document

## 1. Architecture Overview

The Predictive Visibility System sits between flight state management and the notification layer. It consumes `Flight[]` from `FlightStateManager`, notification zone bounds from the client, and `MetarData` from `WeatherCache`, producing `VisibilityPrediction` objects.

**Key decision:** Prediction runs on the server. Zone bounds are sent as SSE query parameters.

### Module boundary

```
Inputs:
  - Flight[] (from FlightStateManager)
  - ZoneBounds (from client, via SSE query params)
  - MetarData (from WeatherCache)

Outputs:
  - VisibilityPrediction[] (emitted via SSE)
```

### New files

- `server/visibility/predictor.ts` — trajectory extrapolation + zone-entry calculation
- `server/visibility/weatherFilter.ts` — weather-based visibility assessment
- `server/visibility/types.ts` — prediction types
- `hooks/useVisibilityPredictions.ts` — consumes predictions, triggers notifications
- `lib/visibilitySettingsContext.tsx` — user-configurable lead time
- `components/VisibilityCountdown.tsx` — "visible in X:XX" countdown
- `components/settings/PredictionSettingsCard.tsx` — settings UI

## 2. Prediction Algorithm

### Trajectory Extrapolation

RWY 27 approaches follow a straight ILS glideslope (~267°), so linear extrapolation is sufficient.

```
1. Convert ground speed from knots to degrees/sec:
   speedMps = speedKts × 0.514444
   headingRad = track × (π / 180)

2. Compute lat/lon velocity:
   dLatPerSec = (speedMps × cos(headingRad)) / 111320
   dLonPerSec = (speedMps × sin(headingRad)) / (111320 × cos(lat × π/180))

3. Find time to enter zone rectangle (south, west, north, east):
   For heading ~267 (moving west), lon decreases:
   tEntry = (zone.east - flight.lon) / dLonPerSec

4. Verify latitude at entry:
   latAtEntry = flight.lat + dLatPerSec × tEntry
   If outside [south, north] → aircraft will miss zone → return null

5. Altitude at entry:
   altAtEntry = flight.alt + (verticalRate × tEntry / 60)
```

### Landing Time Estimate

```
minutesToLanding = flight.alt / |flight.verticalRate|
minutesUntilVisible = tEntry / 60
minutesVisibleBeforeLanding = minutesToLanding - minutesUntilVisible
```

## 3. Weather Integration

Reuse existing `getVisibilityLevel()` from `lib/api/weather.ts`, applied to `altAtEntry`:

- `clear` → `visible`
- `partial` → `partially_visible`
- `obscured` → `obscured`

Additionally, adjust for effective visual range:
```
effectiveVisualRange = min(distanceToZoneEdge, weather.visibility × 1609.34)
```

**Clouds matter, not darkness** — aircraft lights are visible at night.

## 4. Data Flow

### Zone bounds: client → server

Send as SSE query params: `/api/events?south=52.30&west=4.78&north=52.32&east=4.82`

When user changes zone, client reconnects SSE with new params.

### Prediction flow

```
OpenSkyPoller.poll()
  → stateManager.update(flights)
    → FlightStateManager computes approachingFlights
    → In /api/events SSE handler:
      predictor.predict(approachingFlights, connectionZoneBounds, weather)
      → emit 'visibility_predictions' SSE event
```

### Prediction data structure

```typescript
interface VisibilityPrediction {
  flightId: string;
  callsign: string;
  aircraftType: string | null;
  origin?: string;
  secondsUntilZoneEntry: number;
  predictedEntryTime: number;        // unix ms
  predictedAltitudeAtEntry: number;  // feet
  predictedVisibility: 'visible' | 'partially_visible' | 'obscured';
  currentDistanceKm: number;
  currentAltitude: number;
  minutesToLanding: number;
  confidence: 'high' | 'medium' | 'low';
  updatedAt: number;
}
```

## 5. Notification Timing

Notifications are **zone-based, not time-based**. The system fires a notification when it first predicts that an aircraft will enter the user's visibility cone (notification zone).

**Trigger:** When the trajectory extrapolation determines a flight will cross into the zone AND `predictedVisibility` is not `obscured` → fire browser notification with the predicted time.

```
Notification content:
  Title: "KL1234 entering your view in ~2 min"
  Body:  "Boeing 787 from London Heathrow, will be at 1200ft"
```

If partial visibility: "KL1234 approaching your view (low visibility)"
If obscured: no notification (configurable).

The countdown updates each poll cycle as the aircraft gets closer. The notification fires once per flight (deduplicated by flightId). If the prediction is invalidated (go-around, heading change), the notification is not re-sent.

**No zone = no notifications.** The user must draw a visibility zone on the map for predictions and notifications to work.

## 6. Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `notifyPartialVisibility` | true | Notify in marginal weather |
| `notifyObscured` | false | Notify when aircraft will be above clouds |
| `soundEnabled` | false | Play sound with notification |
| `predictionEnabled` | true | Enable/disable the whole system |

## 7. Edge Cases

- **Go-arounds**: verticalRate > 500 while previously approaching → remove prediction
- **Holding patterns**: if `secondsUntilZoneEntry` increases over 3+ cycles → confidence = low, suppress notification
- **Runway change**: heading filter stops matching → no predictions (correct)
- **Aircraft already in zone**: `secondsUntilZoneEntry <= 0` → "visible now"
- **Multiple aircraft**: sort by `secondsUntilZoneEntry` ascending
- **Stale predictions**: remove when flight disappears from OpenSky feed

## 8. Implementation Sequence

1. Types — `server/visibility/types.ts` + update `lib/types.ts`
2. Predictor core — `server/visibility/predictor.ts`
3. Weather filter — `server/visibility/weatherFilter.ts`
4. Server integration — register in `singleton.ts`, wire into `events/route.ts`
5. Client hook — `hooks/useVisibilityPredictions.ts`, update `useFlightEvents.ts`
6. UI countdown — `components/VisibilityCountdown.tsx` in LandingTable
7. Settings — context + card + wire into SettingsPage + Providers
8. Zone reconnection — update `notificationZoneContext.tsx` to trigger SSE reconnect
