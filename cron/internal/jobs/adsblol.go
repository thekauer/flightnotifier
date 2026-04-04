package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
)

type adsblolAirportConfig struct {
	Ident     string
	Name      string
	Latitude  float64
	Longitude float64
}

type adsblolBounds struct {
	LAMin float64
	LOMin float64
	LAMax float64
	LOMax float64
}

type adsblolBoundsOffset struct {
	South float64
	West  float64
	North float64
	East  float64
}

type adsblolAirportPoll struct {
	Airport       adsblolAirportConfig
	QueryRadius   int
	RequestURL    string
	UpstreamTotal int
	Filtered      *adsblolResponse
}

type adsblolResponse struct {
	Now   int64                    `json:"now"`
	Ctime int64                    `json:"ctime"`
	Ptime int64                    `json:"ptime"`
	Total int                      `json:"total"`
	AC    []map[string]interface{} `json:"ac"`
}

type adsblolAirportResult struct {
	Airport       string `json:"airport"`
	QueryRadius   int    `json:"queryRadiusNm"`
	UpstreamTotal int    `json:"upstreamTotal"`
	Matched       int    `json:"matched"`
	Inserted      int    `json:"inserted"`
}

type adsblolResult struct {
	Inserted int                    `json:"inserted"`
	Airports []adsblolAirportResult `json:"airports"`
}

func RunAdsbLol(ctx context.Context) (any, error) {
	client := newAdsbLolHTTPClient()
	polls, err := fetchAdsbLolAirportPolls(ctx, client)
	if err != nil {
		return nil, fmt.Errorf("adsblol airport pulls failed: %w", err)
	}

	conn, err := openDB(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Close(ctx)

	tx, err := conn.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin adsblol transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	airportResults := make([]adsblolAirportResult, 0, len(polls))
	totalInserted := 0
	polledAt := time.Now().UTC()
	for _, poll := range polls {
		result, err := insertAdsbLolAirportStates(ctx, tx, poll, polledAt)
		if err != nil {
			return nil, err
		}
		airportResults = append(airportResults, result)
		totalInserted += result.Inserted
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit adsblol transaction: %w", err)
	}

	return adsblolResult{Inserted: totalInserted, Airports: airportResults}, nil
}

var adsblolAirports = func() []adsblolAirportConfig {
	airports := make([]adsblolAirportConfig, 0, len(monitoredAirports))
	for _, airport := range monitoredAirports {
		airports = append(airports, adsblolAirportConfig{
			Ident:     airport.Ident,
			Name:      airport.Name,
			Latitude:  airport.Latitude,
			Longitude: airport.Longitude,
		})
	}
	return airports
}()

var adsblolReferenceBoundsOffset = adsblolBoundsOffset{
	South: adsblolAirports[0].Latitude - approachBounds.LAMin,
	West:  adsblolAirports[0].Longitude - approachBounds.LOMin,
	North: approachBounds.LAMax - adsblolAirports[0].Latitude,
	East:  approachBounds.LOMax - adsblolAirports[0].Longitude,
}

func fetchAdsbLolAirportPolls(ctx context.Context, client *http.Client) ([]adsblolAirportPoll, error) {
	polls := make([]adsblolAirportPoll, len(adsblolAirports))
	errs := make([]error, len(adsblolAirports))

	var wg sync.WaitGroup
	for i, airport := range adsblolAirports {
		wg.Add(1)
		go func(index int, airport adsblolAirportConfig) {
			defer wg.Done()

			poll, err := fetchAdsbLolAirportPoll(ctx, client, airport)
			if err != nil {
				errs[index] = fmt.Errorf("%s fetch failed: %w", airport.Ident, err)
				return
			}
			polls[index] = poll
		}(i, airport)
	}

	wg.Wait()
	if err := joinAdsbLolErrors(errs); err != nil {
		return nil, err
	}

	return polls, nil
}

func fetchAdsbLolAirportPoll(ctx context.Context, client *http.Client, airport adsblolAirportConfig) (adsblolAirportPoll, error) {
	bounds := adsblolBoundsForAirport(airport)
	queryRadius := adsblolQueryRadiusNM(airport, bounds)
	requestURL := fmt.Sprintf(
		"%s/v2/lat/%.6f/lon/%.6f/dist/%d",
		adsblolBaseURL,
		airport.Latitude,
		airport.Longitude,
		queryRadius,
	)

	data, err := fetchAdsbLolStates(ctx, client, requestURL)
	if err != nil {
		return adsblolAirportPoll{}, err
	}

	filteredAircraft := filterAdsbLolAircraft(bounds, data.AC)
	return adsblolAirportPoll{
		Airport:       airport,
		QueryRadius:   queryRadius,
		RequestURL:    requestURL,
		UpstreamTotal: data.Total,
		Filtered: &adsblolResponse{
			Now:   data.Now,
			Ctime: data.Ctime,
			Ptime: data.Ptime,
			Total: len(filteredAircraft),
			AC:    filteredAircraft,
		},
	}, nil
}

func fetchAdsbLolStates(ctx context.Context, client *http.Client, requestURL string) (*adsblolResponse, error) {

	const maxAttempts = 2
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		data, shouldRetry, err := fetchAdsbLolStatesOnce(ctx, client, requestURL)
		if err == nil {
			return data, nil
		}
		if !shouldRetry || attempt == maxAttempts {
			return nil, err
		}

		wait := adsblolRetryDelay(attempt)
		log.Printf("[cron/adsblol] upstream backoff attempt=%d wait_ms=%d", attempt, wait.Milliseconds())
		if err := sleepWithContext(ctx, wait); err != nil {
			return nil, err
		}
	}

	return nil, errors.New("adsblol retry loop exhausted")
}

func insertAdsbLolAirportStates(ctx context.Context, tx pgx.Tx, poll adsblolAirportPoll, polledAt time.Time) (adsblolAirportResult, error) {
	result := adsblolAirportResult{
		Airport:       poll.Airport.Ident,
		QueryRadius:   poll.QueryRadius,
		UpstreamTotal: poll.UpstreamTotal,
		Matched:       len(poll.Filtered.AC),
	}
	if len(poll.Filtered.AC) == 0 {
		return result, nil
	}

	pollID := newPollUUID()
	batch := &pgx.Batch{}
	inserted := 0

	for _, aircraft := range poll.Filtered.AC {
		if err := ctx.Err(); err != nil {
			return adsblolAirportResult{}, fmt.Errorf("%s insert cancelled: %w", poll.Airport.Ident, err)
		}

		icao24 := trimString(adsblolString(aircraft["hex"]))
		if icao24 == "" {
			continue
		}

		rawJSON, err := mustJSON(aircraft)
		if err != nil {
			return adsblolAirportResult{}, fmt.Errorf("%s encode raw state for %s: %w", poll.Airport.Ident, icao24, err)
		}
		navModesJSON, err := mustJSON(adsblolStringSlice(aircraft["nav_modes"]))
		if err != nil {
			return adsblolAirportResult{}, fmt.Errorf("%s encode nav modes for %s: %w", poll.Airport.Ident, icao24, err)
		}

		batch.Queue(
			`INSERT INTO ingest.adsblol_state_vectors (
				poll_id, polled_at, response_time_ms, icao24, flight, registration,
				aircraft_type, source_type, latitude, longitude, altitude_baro, altitude_geom,
				ground_speed, indicated_air_speed, true_air_speed, mach, track, track_rate,
				roll, magnetic_heading, true_heading, baro_rate, geom_rate, squawk, emergency,
				category, nav_qnh, nav_altitude_mcp, nav_altitude_fms, nav_heading, nav_modes,
				nic, rc, seen, seen_pos, version, nic_baro, nac_p, nac_v, sil, sil_type,
				gva, sda, alert, spi, messages, rssi, distance, direction, raw
			) VALUES (
				$1,$2,$3,$4,$5,$6,
				$7,$8,$9,$10,$11,$12,
				$13,$14,$15,$16,$17,$18,
				$19,$20,$21,$22,$23,$24,$25,
				$26,$27,$28,$29,$30,$31,
				$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,
				$42,$43,$44,$45,$46,$47,$48,$49,$50
			)`,
			pollID,
			polledAt,
			poll.Filtered.Now,
			icao24,
			trimNullableString(adsblolStringPtr(aircraft["flight"])),
			trimNullableString(adsblolStringPtr(aircraft["r"])),
			trimNullableString(adsblolStringPtr(aircraft["t"])),
			trimNullableString(adsblolStringPtr(aircraft["type"])),
			adsblolFloat64Ptr(aircraft["lat"]),
			adsblolFloat64Ptr(aircraft["lon"]),
			adsblolFloat64Ptr(aircraft["alt_baro"]),
			adsblolFloat64Ptr(aircraft["alt_geom"]),
			adsblolFloat64Ptr(aircraft["gs"]),
			adsblolFloat64Ptr(aircraft["ias"]),
			adsblolFloat64Ptr(aircraft["tas"]),
			adsblolFloat64Ptr(aircraft["mach"]),
			adsblolFloat64Ptr(aircraft["track"]),
			adsblolFloat64Ptr(aircraft["track_rate"]),
			adsblolFloat64Ptr(aircraft["roll"]),
			adsblolFloat64Ptr(aircraft["mag_heading"]),
			adsblolFloat64Ptr(aircraft["true_heading"]),
			adsblolFloat64Ptr(aircraft["baro_rate"]),
			adsblolFloat64Ptr(aircraft["geom_rate"]),
			trimNullableString(adsblolStringPtr(aircraft["squawk"])),
			trimNullableString(adsblolStringPtr(aircraft["emergency"])),
			trimNullableString(adsblolStringPtr(aircraft["category"])),
			adsblolFloat64Ptr(aircraft["nav_qnh"]),
			adsblolInt32Ptr(aircraft["nav_altitude_mcp"]),
			adsblolInt32Ptr(aircraft["nav_altitude_fms"]),
			adsblolFloat64Ptr(aircraft["nav_heading"]),
			navModesJSON,
			adsblolInt16Ptr(aircraft["nic"]),
			adsblolInt32Ptr(aircraft["rc"]),
			adsblolFloat32Ptr(aircraft["seen"]),
			adsblolFloat32Ptr(aircraft["seen_pos"]),
			adsblolInt16Ptr(aircraft["version"]),
			adsblolInt16Ptr(aircraft["nic_baro"]),
			adsblolInt16Ptr(aircraft["nac_p"]),
			adsblolInt16Ptr(aircraft["nac_v"]),
			adsblolInt16Ptr(aircraft["sil"]),
			trimNullableString(adsblolStringPtr(aircraft["sil_type"])),
			adsblolInt16Ptr(aircraft["gva"]),
			adsblolInt16Ptr(aircraft["sda"]),
			adsblolBoolFlagPtr(aircraft["alert"]),
			adsblolBoolFlagPtr(aircraft["spi"]),
			adsblolInt32Ptr(aircraft["messages"]),
			adsblolFloat32Ptr(aircraft["rssi"]),
			adsblolFloat32Ptr(aircraft["dst"]),
			adsblolFloat32Ptr(aircraft["dir"]),
			rawJSON,
		)
		inserted++
	}

	results := tx.SendBatch(ctx, batch)
	for i := 0; i < inserted; i++ {
		if _, err := results.Exec(); err != nil {
			results.Close()
			return adsblolAirportResult{}, fmt.Errorf("%s insert adsblol state vectors: %w", poll.Airport.Ident, err)
		}
	}
	if err := results.Close(); err != nil {
		return adsblolAirportResult{}, fmt.Errorf("%s close adsblol batch: %w", poll.Airport.Ident, err)
	}

	result.Inserted = inserted
	return result, nil
}

func adsblolBoundsForAirport(airport adsblolAirportConfig) adsblolBounds {
	return adsblolBounds{
		LAMin: airport.Latitude - adsblolReferenceBoundsOffset.South,
		LOMin: airport.Longitude - adsblolReferenceBoundsOffset.West,
		LAMax: airport.Latitude + adsblolReferenceBoundsOffset.North,
		LOMax: airport.Longitude + adsblolReferenceBoundsOffset.East,
	}
}

func adsblolQueryRadiusNM(airport adsblolAirportConfig, bounds adsblolBounds) int {
	corners := [][2]float64{
		{bounds.LAMin, bounds.LOMin},
		{bounds.LAMin, bounds.LOMax},
		{bounds.LAMax, bounds.LOMin},
		{bounds.LAMax, bounds.LOMax},
	}

	maxDistanceNM := 0.0
	for _, corner := range corners {
		distanceNM := adsblolDistanceNM(airport.Latitude, airport.Longitude, corner[0], corner[1])
		if distanceNM > maxDistanceNM {
			maxDistanceNM = distanceNM
		}
	}

	return int(math.Ceil(maxDistanceNM)) + 1
}

func adsblolDistanceNM(lat1, lon1, lat2, lon2 float64) float64 {
	meanLatRadians := ((lat1 + lat2) / 2) * math.Pi / 180
	latNM := math.Abs(lat2-lat1) * 60
	lonNM := math.Abs(lon2-lon1) * 60 * math.Cos(meanLatRadians)
	return math.Sqrt((latNM * latNM) + (lonNM * lonNM))
}

func filterAdsbLolAircraft(bounds adsblolBounds, aircraft []map[string]interface{}) []map[string]interface{} {
	filtered := make([]map[string]interface{}, 0, len(aircraft))
	for _, state := range aircraft {
		lat, latOK := adsblolFloat64(state["lat"])
		lon, lonOK := adsblolFloat64(state["lon"])
		if !latOK || !lonOK {
			continue
		}
		if lat < bounds.LAMin || lat > bounds.LAMax || lon < bounds.LOMin || lon > bounds.LOMax {
			continue
		}
		filtered = append(filtered, state)
	}
	return filtered
}

func joinAdsbLolErrors(errs []error) error {
	messages := make([]string, 0, len(errs))
	for _, err := range errs {
		if err != nil {
			messages = append(messages, err.Error())
		}
	}
	if len(messages) == 0 {
		return nil
	}
	return errors.New(strings.Join(messages, "; "))
}

func fetchAdsbLolStatesOnce(ctx context.Context, client *http.Client, requestURL string) (*adsblolResponse, bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return nil, false, err
	}

	res, err := client.Do(req)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return nil, false, &phaseTimeoutError{Phase: "adsblol states request", Cause: err}
		}
		return nil, true, fmt.Errorf("adsblol request: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 1024))
		err = fmt.Errorf("adsblol http %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
		if shouldRetryAdsbLolStatus(res.StatusCode) {
			if wait, ok := retryAfterDelay(res); ok {
				log.Printf("[cron/adsblol] upstream requested retry_after_ms=%d status=%d", wait.Milliseconds(), res.StatusCode)
				if sleepErr := sleepWithContext(ctx, wait); sleepErr != nil {
					return nil, false, sleepErr
				}
			}
			return nil, true, err
		}
		return nil, false, err
	}

	var data adsblolResponse
	if err := json.NewDecoder(res.Body).Decode(&data); err != nil {
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return nil, false, &phaseTimeoutError{Phase: "adsblol states decode", Cause: err}
		}
		return nil, true, fmt.Errorf("decode adsblol states: %w", err)
	}

	return &data, false, nil
}

func shouldRetryAdsbLolStatus(status int) bool {
	return status == http.StatusTooManyRequests || status >= http.StatusInternalServerError
}

func retryAfterDelay(res *http.Response) (time.Duration, bool) {
	value := strings.TrimSpace(res.Header.Get("Retry-After"))
	if value == "" {
		return 0, false
	}

	if seconds, err := strconv.Atoi(value); err == nil && seconds > 0 {
		return time.Duration(seconds) * time.Second, true
	}

	if when, err := http.ParseTime(value); err == nil {
		wait := time.Until(when)
		if wait > 0 {
			return wait, true
		}
	}

	return 0, false
}

func adsblolRetryDelay(attempt int) time.Duration {
	switch attempt {
	case 1:
		return 1500 * time.Millisecond
	default:
		return 3 * time.Second
	}
}

func sleepWithContext(ctx context.Context, wait time.Duration) error {
	timer := time.NewTimer(wait)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func adsblolString(value interface{}) string {
	typed, ok := value.(string)
	if !ok {
		return ""
	}
	return typed
}

func adsblolStringPtr(value interface{}) *string {
	text := adsblolString(value)
	if text == "" {
		return nil
	}
	return &text
}

func adsblolStringSlice(value interface{}) []string {
	items, ok := value.([]interface{})
	if !ok || len(items) == 0 {
		return nil
	}
	result := make([]string, 0, len(items))
	for _, item := range items {
		text, ok := item.(string)
		if ok && text != "" {
			result = append(result, text)
		}
	}
	if len(result) == 0 {
		return nil
	}
	return result
}

func adsblolFloat64Ptr(value interface{}) *float64 {
	typed, ok := adsblolFloat64(value)
	if !ok {
		return nil
	}
	return &typed
}

func adsblolFloat64(value interface{}) (float64, bool) {
	switch typed := value.(type) {
	case float64:
		return typed, true
	case int:
		return float64(typed), true
	default:
		return 0, false
	}
}

func adsblolFloat32Ptr(value interface{}) *float32 {
	switch typed := value.(type) {
	case float64:
		converted := float32(typed)
		return &converted
	case int:
		converted := float32(typed)
		return &converted
	default:
		return nil
	}
}

func adsblolInt32Ptr(value interface{}) *int32 {
	switch typed := value.(type) {
	case float64:
		converted := int32(typed)
		return &converted
	case int:
		converted := int32(typed)
		return &converted
	default:
		return nil
	}
}

func adsblolInt16Ptr(value interface{}) *int16 {
	switch typed := value.(type) {
	case float64:
		converted := int16(typed)
		return &converted
	case int:
		converted := int16(typed)
		return &converted
	default:
		return nil
	}
}

func adsblolBoolFlagPtr(value interface{}) *bool {
	switch typed := value.(type) {
	case float64:
		converted := typed != 0
		return &converted
	case int:
		converted := typed != 0
		return &converted
	default:
		return nil
	}
}
