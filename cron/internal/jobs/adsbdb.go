package jobs

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type adsbdbAircraftResponse struct {
	Response struct {
		Aircraft *struct {
			Type            string `json:"type"`
			ICAOType        string `json:"icao_type"`
			Manufacturer    string `json:"manufacturer"`
			Registration    string `json:"registration"`
			RegisteredOwner string `json:"registered_owner"`
		} `json:"aircraft"`
	} `json:"response"`
}

type adsbdbCallsignResponse struct {
	Response struct {
		FlightRoute *struct {
			Callsign string `json:"callsign"`
			Origin   *struct {
				ICAOCode string `json:"icao_code"`
			} `json:"origin"`
			Destination *struct {
				ICAOCode string `json:"icao_code"`
			} `json:"destination"`
		} `json:"flightroute"`
	} `json:"response"`
}

type adsbdbResult struct {
	InsertedAircraft int `json:"inserted_aircraft"`
	InsertedRoutes   int `json:"inserted_routes"`
}

func RunAdsbdb(ctx context.Context) (any, error) {
	client := newHTTPClient()
	adsblolClient := newAdsbLolHTTPClient()
	conn, err := openDB(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Close(ctx)

	rows, err := conn.Query(ctx, `
		SELECT DISTINCT sv.icao24
		FROM ingest.opensky_state_vectors sv
		LEFT JOIN public.aircraft a ON sv.icao24 = a.icao24
		WHERE a.icao24 IS NULL
		ORDER BY sv.icao24
		LIMIT $1
	`, adsbdbMaxCandidates)
	if err != nil {
		return nil, fmt.Errorf("query adsbdb candidates: %w", err)
	}
	defer rows.Close()

	var icao24s []string
	for rows.Next() {
		var icao24 string
		if err := rows.Scan(&icao24); err != nil {
			return nil, err
		}
		icao24s = append(icao24s, icao24)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	insertedAircraft := 0
	now := time.Now().UTC()

	for start := 0; start < len(icao24s); start += adsbdbBatchSize {
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		end := start + adsbdbBatchSize
		if end > len(icao24s) {
			end = len(icao24s)
		}

		batch := &pgx.Batch{}
		queued := 0

		for _, icao24 := range icao24s[start:end] {
			info, err := fetchAircraftInfo(ctx, client, icao24)
			if err != nil || info == nil {
				continue
			}

			batch.Queue(
				`INSERT INTO public.aircraft (
					icao24, icao_type, manufacturer, registration, owner, first_seen_at, updated_at
				) VALUES ($1,$2,$3,$4,$5,$6,$7)
				ON CONFLICT (icao24) DO NOTHING`,
				strings.ToLower(icao24),
				nullableString(info.ICAOType),
				nullableString(info.Manufacturer),
				nullableString(info.Registration),
				nullableString(info.RegisteredOwner),
				now,
				now,
			)
			queued++
		}

		results := conn.SendBatch(ctx, batch)
		for i := 0; i < queued; i++ {
			tag, err := results.Exec()
			if err != nil {
				results.Close()
				return nil, fmt.Errorf("insert aircraft metadata: %w", err)
			}
			insertedAircraft += int(tag.RowsAffected())
		}
		if err := results.Close(); err != nil {
			return nil, err
		}
	}

	insertedRoutes, err := upsertRouteCandidates(ctx, conn, client, adsblolClient, now)
	if err != nil {
		return nil, err
	}

	return adsbdbResult{InsertedAircraft: insertedAircraft, InsertedRoutes: insertedRoutes}, nil
}

type aircraftInfo struct {
	ICAOType        string
	Manufacturer    string
	Registration    string
	RegisteredOwner string
}

func fetchAircraftInfo(ctx context.Context, client *http.Client, icao24 string) (*aircraftInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, adsbdbBaseURL+"/aircraft/"+strings.ToLower(icao24), nil)
	if err != nil {
		return nil, err
	}

	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, nil
	}

	var payload adsbdbAircraftResponse
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decode adsbdb aircraft: %w", err)
	}
	if payload.Response.Aircraft == nil {
		return nil, nil
	}

	return &aircraftInfo{
		ICAOType:        payload.Response.Aircraft.ICAOType,
		Manufacturer:    payload.Response.Aircraft.Manufacturer,
		Registration:    payload.Response.Aircraft.Registration,
		RegisteredOwner: payload.Response.Aircraft.RegisteredOwner,
	}, nil
}

type routeInfo struct {
	Origin      string
	Destination string
	Route       string
}

type routeCandidate struct {
	Callsign string
	Lat      *float64
	Lng      *float64
}

type adsblolRoutePlane struct {
	Callsign string  `json:"callsign"`
	Lat      float64 `json:"lat"`
	Lng      float64 `json:"lng"`
}

type adsblolRouteRequest struct {
	Planes []adsblolRoutePlane `json:"planes"`
}

type adsblolAirport struct {
	ICAO string `json:"icao"`
}

type adsblolRouteResponse struct {
	Callsign     string           `json:"callsign"`
	AirportCodes string           `json:"airport_codes"`
	Airports     []adsblolAirport `json:"_airports"`
	Plausible    bool             `json:"plausible"`
}

func upsertRouteCandidates(ctx context.Context, conn *pgx.Conn, client *http.Client, adsblolClient *http.Client, now time.Time) (int, error) {
	rows, err := conn.Query(ctx, `
		WITH latest_adsblol_poll AS (
			SELECT max(polled_at) AS polled_at
			FROM ingest.adsblol_state_vectors
		),
		recent_callsigns AS (
			SELECT DISTINCT
				upper(regexp_replace(trim(callsign), '\s+', '', 'g')) AS callsign,
				NULL::double precision AS latitude,
				NULL::double precision AS longitude,
				0 AS priority
			FROM ingest.opensky_state_vectors
			WHERE polled_at >= now() - interval '6 hours'
			  AND callsign IS NOT NULL
			  AND trim(callsign) <> ''
			UNION
			SELECT DISTINCT
				upper(regexp_replace(trim(flight), '\s+', '', 'g')) AS callsign,
				latitude,
				longitude,
				1 AS priority
			FROM ingest.adsblol_state_vectors
			WHERE polled_at = (SELECT polled_at FROM latest_adsblol_poll)
			  AND flight IS NOT NULL
			  AND trim(flight) <> ''
			  AND latitude IS NOT NULL
			  AND longitude IS NOT NULL
		),
		deduped_callsigns AS (
			SELECT DISTINCT ON (callsign)
				callsign,
				latitude,
				longitude,
				priority
			FROM recent_callsigns
			ORDER BY callsign, priority DESC
		)
		SELECT dc.callsign, dc.latitude, dc.longitude
		FROM deduped_callsigns dc
		LEFT JOIN public.flight_routes fr ON fr.callsign = dc.callsign
		WHERE fr.callsign IS NULL
		   OR fr.updated_at < now() - interval '12 hours'
		ORDER BY dc.priority DESC, dc.callsign
		LIMIT $1
	`, adsbdbMaxCandidates)
	if err != nil {
		return 0, fmt.Errorf("query route candidates: %w", err)
	}
	defer rows.Close()

	var candidates []routeCandidate
	for rows.Next() {
		var candidate routeCandidate
		if err := rows.Scan(&candidate.Callsign, &candidate.Lat, &candidate.Lng); err != nil {
			return 0, err
		}
		candidates = append(candidates, candidate)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	routeMap, err := fetchAdsbLolRouteInfo(ctx, adsblolClient, candidates)
	if err != nil {
		fmt.Printf("[cron/adsbdb] adsblol routeset unavailable, falling back to adsbdb: %v\n", err)
		routeMap = map[string]*routeInfo{}
	}

	inserted := 0
	for start := 0; start < len(candidates); start += adsbdbBatchSize {
		end := start + adsbdbBatchSize
		if end > len(candidates) {
			end = len(candidates)
		}

		batch := &pgx.Batch{}
		queued := 0

		for _, candidate := range candidates[start:end] {
			info := routeMap[candidate.Callsign]
			var err error
			if info == nil {
				info, err = fetchRouteInfo(ctx, client, candidate.Callsign)
			}
			if err != nil || info == nil {
				continue
			}

			batch.Queue(
				`INSERT INTO public.flight_routes (
					callsign, origin, destination, route, first_seen_at, updated_at
				) VALUES ($1,$2,$3,$4,$5,$6)
				ON CONFLICT (callsign) DO UPDATE SET
					origin = EXCLUDED.origin,
					destination = EXCLUDED.destination,
					route = EXCLUDED.route,
					updated_at = EXCLUDED.updated_at`,
				candidate.Callsign,
				nullableString(info.Origin),
				nullableString(info.Destination),
				nullableString(info.Route),
				now,
				now,
			)
			queued++
		}

		results := conn.SendBatch(ctx, batch)
		for i := 0; i < queued; i++ {
			if _, err := results.Exec(); err != nil {
				results.Close()
				return 0, fmt.Errorf("upsert flight routes: %w", err)
			}
			inserted++
		}
		if err := results.Close(); err != nil {
			return 0, err
		}
	}

	return inserted, nil
}

func fetchAdsbLolRouteInfo(ctx context.Context, client *http.Client, candidates []routeCandidate) (map[string]*routeInfo, error) {
	planes := make([]adsblolRoutePlane, 0, len(candidates))
	for _, candidate := range candidates {
		if candidate.Lat == nil || candidate.Lng == nil {
			continue
		}
		planes = append(planes, adsblolRoutePlane{
			Callsign: candidate.Callsign,
			Lat:      *candidate.Lat,
			Lng:      *candidate.Lng,
		})
	}

	if len(planes) == 0 {
		return map[string]*routeInfo{}, nil
	}

	body, err := json.Marshal(adsblolRouteRequest{Planes: planes})
	if err != nil {
		return nil, fmt.Errorf("marshal adsblol routeset request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, adsblolBaseURL+"/api/0/routeset", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("adsblol routeset request: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		responseBody, _ := io.ReadAll(io.LimitReader(res.Body, 1024))
		return nil, fmt.Errorf("adsblol routeset http %d: %s", res.StatusCode, strings.TrimSpace(string(responseBody)))
	}

	var payload []adsblolRouteResponse
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decode adsblol routeset: %w", err)
	}

	result := make(map[string]*routeInfo, len(payload))
	for _, route := range payload {
		info := routeInfoFromAdsbLol(route)
		if info == nil {
			continue
		}
		result[strings.ToUpper(strings.TrimSpace(route.Callsign))] = info
	}
	return result, nil
}

func routeInfoFromAdsbLol(route adsblolRouteResponse) *routeInfo {
	if strings.EqualFold(strings.TrimSpace(route.AirportCodes), "unknown") {
		return nil
	}

	origin := ""
	destination := ""
	if len(route.Airports) > 0 {
		origin = strings.TrimSpace(route.Airports[0].ICAO)
		destination = strings.TrimSpace(route.Airports[len(route.Airports)-1].ICAO)
	}

	if origin == "" || destination == "" {
		parts := strings.Split(route.AirportCodes, "-")
		if len(parts) > 0 {
			origin = strings.TrimSpace(parts[0])
			destination = strings.TrimSpace(parts[len(parts)-1])
		}
	}

	if origin == "" && destination == "" {
		return nil
	}

	display := ""
	if origin != "" && destination != "" {
		display = origin + " -> " + destination
	}

	return &routeInfo{
		Origin:      nullableUpper(origin),
		Destination: nullableUpper(destination),
		Route:       display,
	}
}

func fetchRouteInfo(ctx context.Context, client *http.Client, callsign string) (*routeInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, adsbdbBaseURL+"/callsign/"+strings.ToUpper(strings.TrimSpace(callsign)), nil)
	if err != nil {
		return nil, err
	}

	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, nil
	}

	var payload adsbdbCallsignResponse
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decode adsbdb route: %w", err)
	}
	if payload.Response.FlightRoute == nil {
		return nil, nil
	}

	origin := ""
	destination := ""
	if payload.Response.FlightRoute.Origin != nil {
		origin = payload.Response.FlightRoute.Origin.ICAOCode
	}
	if payload.Response.FlightRoute.Destination != nil {
		destination = payload.Response.FlightRoute.Destination.ICAOCode
	}
	route := ""
	if origin != "" && destination != "" {
		route = origin + " -> " + destination
	}

	return &routeInfo{
		Origin:      origin,
		Destination: destination,
		Route:       route,
	}, nil
}

func nullableUpper(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

func nullableString(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}
