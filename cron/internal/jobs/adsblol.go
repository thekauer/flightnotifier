package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type adsblolResponse struct {
	Now   int64                    `json:"now"`
	Ctime int64                    `json:"ctime"`
	Ptime int64                    `json:"ptime"`
	Total int                      `json:"total"`
	AC    []map[string]interface{} `json:"ac"`
}

type adsblolResult struct {
	Inserted int `json:"inserted"`
	Total    int `json:"total"`
}

func RunAdsbLol(ctx context.Context) (any, error) {
	client := newAdsbLolHTTPClient()
	conn, err := openDB(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Close(ctx)

	data, err := fetchAdsbLolStates(ctx, client)
	if err != nil {
		return nil, err
	}
	if len(data.AC) == 0 {
		return adsblolResult{Inserted: 0, Total: data.Total}, nil
	}

	pollID := newPollUUID()
	polledAt := time.Now().UTC()
	batch := &pgx.Batch{}
	inserted := 0

	for _, aircraft := range data.AC {
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		icao24 := trimString(adsblolString(aircraft["hex"]))
		if icao24 == "" {
			continue
		}

		rawJSON, err := mustJSON(aircraft)
		if err != nil {
			return nil, err
		}
		navModesJSON, err := mustJSON(adsblolStringSlice(aircraft["nav_modes"]))
		if err != nil {
			return nil, err
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
			data.Now,
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

	results := conn.SendBatch(ctx, batch)
	for i := 0; i < inserted; i++ {
		if _, err := results.Exec(); err != nil {
			results.Close()
			return nil, fmt.Errorf("insert adsblol state vectors: %w", err)
		}
	}
	if err := results.Close(); err != nil {
		return nil, fmt.Errorf("close adsblol batch: %w", err)
	}

	return adsblolResult{Inserted: inserted, Total: data.Total}, nil
}

func fetchAdsbLolStates(ctx context.Context, client *http.Client) (*adsblolResponse, error) {
	requestURL := fmt.Sprintf(
		"%s/v2/lat/%v/lon/%v/dist/25",
		adsblolBaseURL,
		52.3086,
		4.7639,
	)

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
	switch typed := value.(type) {
	case float64:
		return &typed
	case int:
		converted := float64(typed)
		return &converted
	default:
		return nil
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
