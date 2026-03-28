# API Research: Flight Data Sources for EHAM

Date: 2026-03-28

## 1. Upcoming Arrivals at EHAM (next 30 minutes, with delays)

### Schiphol Flight API (BEST OPTION)

- **URL**: `https://api.schiphol.nl/public-flights/flights`
- **Free**: Yes, free tier available. Requires registration at developer.schiphol.nl.
- **Auth**: `app_id` + `app_key` (headers in v4+, query params in v3).
- **Rate limits**: 100 requests per 60 seconds per connection (from Microsoft connector docs). Exact daily limits not publicly documented; contact api-support@schiphol.nl.
- **Data fields** (confirmed from Microsoft Power Platform connector docs):
  - `scheduleDateTime`, `scheduleDate`, `scheduleTime`
  - `estimatedLandingTime` -- accounts for delays
  - `actualLandingTime`
  - `actualOffBlockTime`, `publicEstimatedOffBlockTime`
  - `flightName` (e.g. "KL1234"), `flightNumber`, `prefixIATA`, `prefixICAO`
  - `flightDirection` ("A" for arrival, "D" for departure)
  - `terminal` (integer)
  - `route.destinations` (array of IATA codes)
  - `publicFlightState.flightStates` (e.g. ["SCH"], ["AIR"], ["LND"])
  - `aircraftType.iataMain`, `aircraftRegistration`
  - `baggageClaim.belts`, `expectedTimeOnBelt`
  - `codeshares`
  - `lastUpdatedAt`
  - **No runway field** -- gate/terminal only
- **Query params**: `flightDirection=A`, `fromDateTime`, `toDateTime`, `searchDateTimeField=estimatedLandingTime`, `includedelays=true`, `sort=+estimatedLandingTime`
- **How to get next-30-min arrivals**: Query with `flightDirection=A`, `fromDateTime=now`, `toDateTime=now+30m`, `searchDateTimeField=estimatedLandingTime`.
- **Verdict**: Excellent. Official Schiphol data with estimated times that account for delays. Free. The only EHAM-specific API. **Recommended primary source.**
- **Caveat**: Portal migrating to new system in 2026; may need to re-register.

### AirLabs Data API

- **URL**: `https://airlabs.co/api/v9/schedules?arr_iata=AMS&api_key=KEY`
- **Free**: Yes, 1,000 requests/month.
- **Auth**: API key (query param).
- **Rate limits**: Free tier limited to 50 results per query. Data available up to 10 hours ahead.
- **Data fields**: scheduled/estimated/actual departure & arrival times (local + UTC + UNIX), terminals, gates, delay minutes (`arr_delayed`), flight status (scheduled/active/landed/cancelled), airline, flight number, codeshares, baggage claim.
- **No runway field**.
- **Verdict**: Good fallback. Generous free tier (1,000 req/month), has delay info. But Schiphol API is more authoritative for EHAM.

### AviationStack

- **URL**: `https://api.aviationstack.com/v1/flights?arr_iata=AMS&access_key=KEY`
- **Free**: 100 requests/month (free plan). Free plan: 1 request per 60 seconds.
- **Auth**: API key.
- **Rate limits**: 100 calls/month, 1 req/60s on free plan.
- **Data fields**: Flight number, airline, status (active/delayed/cancelled), scheduled and estimated times, terminal, gate, airport codes.
- **Verdict**: Too limited for real-time use. 100 calls/month = ~3 calls/day. Not viable for polling every few minutes.

### FlightAware AeroAPI

- **URL**: `GET /airports/{id}/flights/arrivals`
- **Free**: Personal use only. $0 monthly minimum, up to $5/month free credit ($10 for ADS-B feeders). 10 result sets/minute. Each result set = 15 records at $0.005/set.
- **Auth**: API key.
- **Data fields**: Current flight status, tracks, maps. No runway data.
- **Verdict**: Usable for personal projects ($5 free/month = ~1,000 queries). Has good delay data. But usage-based pricing is risky; easy to exceed $5/month with frequent polling.

### Flightradar24 API

- **URL**: `https://fr24api.flightradar24.com/api/...`
- **Free**: Sandbox only (test endpoints, no real data). Paid starts at $9/month (Explorer: 30,000 credits).
- **Auth**: API key.
- **Data fields**: Live positions, historical tracks, airport/airline reference data.
- **Verdict**: Not free for production use. Sandbox is for testing only. $9/month Explorer plan is affordable but not free.

### OpenSky Network (arrivals endpoint)

- **URL**: `https://opensky-network.org/api/flights/arrival?airport=EHAM&begin=X&end=Y`
- **Free**: Yes, 4,000 credits/day (8,000 for ADS-B feeders). OAuth2 required.
- **Limitation**: **Arrivals are batch-processed overnight.** Only arrivals from the previous day or earlier are available. Cannot be used for upcoming/real-time arrivals.
- **Verdict**: Useless for "next 30 minutes" arrivals. Only historical.

### Summary: Upcoming Arrivals

| Source | Free? | Calls | Has delays? | Real-time? | Recommended? |
|--------|-------|-------|-------------|------------|-------------|
| **Schiphol API** | Yes | ~100/min | Yes (`estimatedLandingTime`) | Yes | **Yes** |
| AirLabs | Yes (1K/mo) | 1K/month | Yes (`arr_delayed`) | ~10h ahead | Fallback |
| AviationStack | Yes (100/mo) | 100/month | Yes | Yes | No (too few) |
| FlightAware | $5 free/mo | ~1K/month | Yes | Yes | Maybe |
| Flightradar24 | No ($9/mo) | 30K/month | Yes | Yes | No (paid) |
| OpenSky arrivals | Yes | 4K/day | N/A | **No (batch)** | No |

---

## 2. Historical Flight Data (which runway did flight X land on?)

### OpenSky Network /tracks Endpoint

- **URL**: `https://opensky-network.org/api/tracks/all?icao24=ADDR&time=UNIX`
- **Free**: Yes (experimental endpoint). Same credit system as above.
- **Data fields**: Array of waypoints with `[time, latitude, longitude, baroAltitude, trueTrack, onGround]`. Also: `icao24`, `callsign`, `startTime`, `endTime`.
- **Waypoint selection**: Min 15-min intervals, track changes >2.5deg, altitude changes >100m, ground transitions.
- **Limitation**: Waypoint resolution is coarse (15-min intervals during cruise). Final approach detail may be insufficient for runway inference.
- **Verdict**: Free historical tracks but coarse resolution. May work for runway inference if the ground-transition waypoint captures the final heading.

### OpenSky Network /states/all (live state vectors)

- **URL**: `https://opensky-network.org/api/states/all?icao24=ADDR`
- **Already used** in current codebase for live tracking.
- **Data fields**: latitude, longitude, altitude, heading (`true_track`), velocity, `on_ground`, callsign.
- **Update rate**: 5-second resolution for authenticated users.
- **Verdict**: Good for **real-time** runway inference (we already do this in `detector.ts`). Not useful for historical lookups.

### adsbdb.com

- **URL**: `https://api.adsbdb.com/v0/callsign/{CALLSIGN}`
- **Free**: Yes, no auth required.
- **Data fields**: Aircraft info (Mode S, registration, type, owner), flight route (origin/destination airports, callsign).
- **No historical track data. No runway data.**
- **Verdict**: Useful for aircraft metadata only. Cannot determine runway.

### ADS-B Exchange

- **URL**: RapidAPI-based, no longer has a free tier (changed early 2025).
- **Paid**: Basic plan ~$10/month, 10,000 requests/month.
- **Historical data**: They do offer operations data with runway detection ("Using ADS-B path data, we determine takeoffs and landings with runway used"). But this is an enterprise/paid product.
- **Verdict**: Not free. Enterprise historical data product.

### AeroDataBox

- **URL**: `https://aerodatabox.p.rapidapi.com/flights/...` (via RapidAPI or API.Market)
- **Free**: 300-600 calls/month on free/trial plan (API.Market free; RapidAPI $0.99/mo).
- **Data fields**: FIDS with scheduled/estimated/actual times, terminals, gates. Also has **runway detection based on ADS-B data** for some airports. Flight history endpoint available.
- **Runway data**: Available for "some airports" -- likely includes EHAM given its size. Integrated into flight status responses.
- **Verdict**: **Best option for historical runway data** if EHAM is covered. Worth testing. Free tier sufficient for occasional lookups.

### Flightradar24

- **Historical tracks**: Available on paid plans. Includes detailed position data.
- **Pricing**: Starts at $9/month (Explorer).
- **Verdict**: Paid only. Would provide excellent track data for runway inference but not free.

### Summary: Historical Data

| Source | Free? | Has tracks? | Has runway? | Coverage |
|--------|-------|-------------|-------------|----------|
| OpenSky /tracks | Yes | Yes (coarse) | No (infer) | Global |
| OpenSky /states | Yes (live only) | Live only | No (infer) | Global |
| **AeroDataBox** | Yes (300-600/mo) | No | **Yes (some airports)** | Partial |
| ADS-B Exchange | No ($10+/mo) | Yes | Yes | Global |
| Flightradar24 | No ($9/mo) | Yes | No (infer) | Global |
| adsbdb.com | Yes | No | No | N/A |

---

## 3. Runway Inference

### Does any free API directly report which runway a flight landed on?

**AeroDataBox** is the only free-tier API that claims to provide runway detection. It uses community ADS-B data to detect takeoff/landing runway "for some airports." Whether EHAM is covered needs to be tested empirically.

No other free API provides a direct runway field.

### How to infer runway from ADS-B data

Since we already have live OpenSky state vectors in our app, and we already run approach detection in `server/opensky/detector.ts`, the most practical approach is:

1. **Final approach heading**: When an aircraft's `on_ground` transitions from `false` to `true` (or altitude drops below ~200ft), capture the `true_track` (heading).
2. **Final position**: Capture the last airborne lat/lon position.
3. **Match to runway threshold**: Compare the final heading and position against known runway thresholds at EHAM:
   - **06/24 (Kaagbaan)**: headings ~058/238
   - **09/27 (Buitenveldertbaan)**: headings ~087/267
   - **18R/36L (Polderbaan)**: headings ~183/003
   - **18C/36C (Zwanenburgbaan)**: headings ~183/003
   - **18L/36R (Aalsmeerbaan)**: headings ~183/003
   - **04/22 (Oostbaan)**: headings ~042/222
4. **Distance check**: Verify the final position is within ~2km of the matched runway threshold using Haversine formula.
5. **Altitude filter**: Only consider ADS-B points below 5,000ft (captures final approach phase).

This is essentially what research papers describe and what AeroDataBox does internally. The `traffic` Python library also has a `guess_runway()` function for this.

### Recommended approach for our app

- **Real-time**: Continue using OpenSky state vectors + our existing `detector.ts` heading-based approach cone detection. Enhance it to also record which runway was used on touchdown.
- **Historical**: Try AeroDataBox free tier to see if it returns runway for EHAM flights. If not, fall back to recording our own observations (when we see a flight land via state vectors, store the runway we inferred).

---

## 4. Recommendations

### For upcoming arrivals (primary goal)

**Use the Schiphol Flight API.** It is:
- Free
- Official source for EHAM data
- Has `estimatedLandingTime` (accounts for delays)
- Can query by time range with `fromDateTime`/`toDateTime`
- Has flight status, terminal, airline, flight number
- Updated in real-time by airlines via CISS

Implementation:
```
GET https://api.schiphol.nl/public-flights/flights
  ?flightDirection=A
  &fromDateTime={now}
  &toDateTime={now+30min}
  &searchDateTimeField=estimatedLandingTime
  &includedelays=true
  &sort=+estimatedLandingTime
Headers: app_id, app_key, ResourceVersion: v4, Accept: application/json
```

### For runway data

1. **Real-time**: Enhance existing `detector.ts` to record runway on touchdown (heading + position matching).
2. **Historical**: Test AeroDataBox free tier for EHAM runway data. If available, use it to validate/supplement our own inference.
3. **Fallback**: Build our own historical runway log from real-time observations.

### For flight metadata (callsign to flight number mapping)

Continue using **adsbdb.com** (free, no auth) for aircraft/route lookups.
