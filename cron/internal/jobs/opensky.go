package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type openSkyAuthResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
}

type openSkyResponse struct {
	Time   int64           `json:"time"`
	States [][]interface{} `json:"states"`
}

type openSkyTrackResponse struct {
	ICAO24    string            `json:"icao24"`
	StartTime int64             `json:"startTime"`
	EndTime   int64             `json:"endTime"`
	Callsign  *string           `json:"callsign"`
	Path      [][]interface{}   `json:"path"`
}

type openSkyResult struct {
	Inserted int `json:"inserted"`
}

func RunOpenSky(ctx context.Context) (any, error) {
	client := newOpenSkyHTTPClient()
	conn, err := openDB(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Close(ctx)

	data, err := fetchOpenSkyStates(ctx, client)
	if err != nil {
		return nil, err
	}
	if len(data.States) == 0 {
		return openSkyResult{Inserted: 0}, nil
	}

	pollID := newPollUUID()
	polledAt := time.Now().UTC()

	batch := &pgx.Batch{}
	inserted := 0

	for _, state := range data.States {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		sensorsJSON, err := sensorsJSON(stateValue(state, 12))
		if err != nil {
			return nil, err
		}

		batch.Queue(
			`INSERT INTO ingest.opensky_state_vectors (
				poll_id, polled_at, response_time, icao24, callsign, origin_country,
				time_position, last_contact, longitude, latitude, baro_altitude,
				on_ground, velocity, true_track, vertical_rate, sensors, geo_altitude,
				squawk, spi, position_source
			) VALUES (
				$1,$2,$3,$4,$5,$6,
				$7,$8,$9,$10,$11,
				$12,$13,$14,$15,$16,$17,
				$18,$19,$20
			)`,
			pollID,
			polledAt,
			int32(data.Time),
			trimString(asString(stateValue(state, 0))),
			trimNullableString(asStringPtr(stateValue(state, 1))),
			asStringPtr(stateValue(state, 2)),
			asInt32Ptr(stateValue(state, 3)),
			asInt32Ptr(stateValue(state, 4)),
			asFloat64Ptr(stateValue(state, 5)),
			asFloat64Ptr(stateValue(state, 6)),
			asFloat64Ptr(stateValue(state, 7)),
			asBoolPtr(stateValue(state, 8)),
			asFloat64Ptr(stateValue(state, 9)),
			asFloat64Ptr(stateValue(state, 10)),
			asFloat64Ptr(stateValue(state, 11)),
			sensorsJSON,
			asFloat64Ptr(stateValue(state, 13)),
			asStringPtr(stateValue(state, 14)),
			asBoolPtr(stateValue(state, 15)),
			asInt16Ptr(stateValue(state, 16)),
		)
		inserted++
	}

	results := conn.SendBatch(ctx, batch)
	for i := 0; i < inserted; i++ {
		if _, err := results.Exec(); err != nil {
			results.Close()
			return nil, fmt.Errorf("insert opensky state vectors: %w", err)
		}
	}
	if err := results.Close(); err != nil {
		return nil, fmt.Errorf("close opensky batch: %w", err)
	}

	return openSkyResult{Inserted: inserted}, nil
}

func fetchOpenSkyStates(ctx context.Context, client *http.Client) (*openSkyResponse, error) {
	requestURL := fmt.Sprintf(
		"%s/states/all?lamin=%v&lomin=%v&lamax=%v&lomax=%v",
		openskyBaseURL,
		approachBounds.LAMin,
		approachBounds.LOMin,
		approachBounds.LAMax,
		approachBounds.LOMax,
	)

	res, err := doOpenSkyRequest(ctx, client, requestURL)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return nil, &phaseTimeoutError{Phase: "opensky states request", Cause: err}
		}
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 1024))
		return nil, fmt.Errorf("opensky states http %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	}

	var data openSkyResponse
	if err := json.NewDecoder(res.Body).Decode(&data); err != nil {
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return nil, &phaseTimeoutError{Phase: "opensky states decode", Cause: err}
		}
		return nil, fmt.Errorf("decode opensky states: %w", err)
	}

	return &data, nil
}

func doOpenSkyRequest(ctx context.Context, client *http.Client, requestURL string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return nil, err
	}

	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	if res.StatusCode != http.StatusUnauthorized && res.StatusCode != http.StatusForbidden {
		return res, nil
	}
	res.Body.Close()

	token, err := fetchOpenSkyToken(ctx, client)
	if err != nil {
		return nil, err
	}
	if token == "" {
		return nil, fmt.Errorf("opensky auth unavailable after %d response", res.StatusCode)
	}

	retryReq, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return nil, err
	}
	retryReq.Header.Set("Authorization", "Bearer "+token)
	return client.Do(retryReq)
}

func fetchOpenSkyToken(ctx context.Context, client *http.Client) (string, error) {
	clientID := os.Getenv("OPENSKY_CLIENT_ID")
	clientSecret := os.Getenv("OPENSKY_CLIENT_SECRET")
	if clientID == "" || clientSecret == "" {
		return "", nil
	}

	form := url.Values{}
	form.Set("grant_type", "client_credentials")
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, openskyAuthURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	res, err := client.Do(req)
	if err != nil {
		log.Printf("[cron/opensky] auth fallback to unauthenticated request: %v", err)
		return "", nil
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 1024))
		log.Printf("[cron/opensky] auth fallback to unauthenticated request: http %d %s", res.StatusCode, strings.TrimSpace(string(body)))
		return "", nil
	}

	var auth openSkyAuthResponse
	if err := json.NewDecoder(res.Body).Decode(&auth); err != nil {
		log.Printf("[cron/opensky] auth fallback to unauthenticated request: decode failed: %v", err)
		return "", nil
	}

	return auth.AccessToken, nil
}

func fetchOpenSkyTrack(ctx context.Context, client *http.Client, icao24 string, requestedTime int64) (*openSkyTrackResponse, error) {
	endpoints := []string{"/tracks", "/tracks/all"}
	for i, endpoint := range endpoints {
		requestURL := fmt.Sprintf("%s%s?icao24=%s&time=%d", openskyBaseURL, endpoint, url.QueryEscape(strings.ToLower(icao24)), requestedTime)
		res, err := doOpenSkyRequest(ctx, client, requestURL)
		if err != nil {
			if errors.Is(err, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
				return nil, &phaseTimeoutError{Phase: "opensky track request", Cause: err}
			}
			return nil, fmt.Errorf("opensky track request: %w", err)
		}

		if res.StatusCode == http.StatusNotFound && i < len(endpoints)-1 {
			res.Body.Close()
			continue
		}
		if res.StatusCode == http.StatusNotFound {
			res.Body.Close()
			return nil, os.ErrNotExist
		}
		if res.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(io.LimitReader(res.Body, 1024))
			res.Body.Close()
			return nil, fmt.Errorf("opensky track http %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
		}

		var track openSkyTrackResponse
		err = json.NewDecoder(res.Body).Decode(&track)
		res.Body.Close()
		if err != nil {
			if errors.Is(err, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
				return nil, &phaseTimeoutError{Phase: "opensky track decode", Cause: err}
			}
			return nil, fmt.Errorf("decode opensky track: %w", err)
		}
		return &track, nil
	}
	return nil, errors.New("opensky track unavailable")
}

func stateValue(values []interface{}, index int) interface{} {
	if index < 0 || index >= len(values) {
		return nil
	}
	return values[index]
}

func asString(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return typed
	default:
		return ""
	}
}

func asStringPtr(value interface{}) *string {
	text := asString(value)
	if text == "" {
		return nil
	}
	return &text
}

func trimString(value string) string {
	return strings.TrimSpace(value)
}

func trimNullableString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func asFloat64Ptr(value interface{}) *float64 {
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

func asInt32Ptr(value interface{}) *int32 {
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

func asInt16Ptr(value interface{}) *int16 {
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

func asBoolPtr(value interface{}) *bool {
	typed, ok := value.(bool)
	if !ok {
		return nil
	}
	return &typed
}

func sensorsJSON(value interface{}) ([]byte, error) {
	switch typed := value.(type) {
	case nil:
		return nil, nil
	case []interface{}:
		sensors := make([]int, 0, len(typed))
		for _, sensorValue := range typed {
			switch number := sensorValue.(type) {
			case float64:
				sensors = append(sensors, int(number))
			case int:
				sensors = append(sensors, number)
			}
		}
		return mustJSON(sensors)
	default:
		return nil, nil
	}
}
