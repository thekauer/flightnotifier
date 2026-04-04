package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type aviationWeatherResponse struct {
	ICAOID string            `json:"icaoId"`
	RawOb  string            `json:"rawOb"`
	ObsTime int64            `json:"obsTime"`
	Temp   *float64          `json:"temp"`
	DEWP   *float64          `json:"dewp"`
	WDir   interface{}       `json:"wdir"`
	WSpd   *float64          `json:"wspd"`
	WGST   *float64          `json:"wgst"`
	Visib  interface{}       `json:"visib"`
	Clouds []aviationCloud   `json:"clouds"`
	Altim  *float64          `json:"altim"`
	FLTCat string            `json:"fltCat"`
}

type aviationCloud struct {
	Cover string `json:"cover"`
	Base  int    `json:"base"`
}

type metarResult struct {
	Station string `json:"station"`
	Raw     string `json:"raw"`
}

func RunMetar(ctx context.Context) (any, error) {
	client := newMetarHTTPClient()
	conn, err := openDB(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Close(ctx)

	data, err := fetchMetar(ctx, client, metarStation)
	if err != nil {
		return nil, err
	}

	cloudsJSON, err := mustJSON(data.Clouds)
	if err != nil {
		return nil, err
	}

	observationTime := time.Unix(data.ObsTime, 0).UTC()
	windDirection := parseWindDirection(data.WDir)
	visibility := parseVisibility(data.Visib)
	ceiling := parseCeiling(data.Clouds)

	_, err = conn.Exec(
		ctx,
		`INSERT INTO ingest.metar (
			fetched_at, station, raw, observation_time, temp, dewpoint,
			wind_direction, wind_speed, wind_gust, visibility, clouds,
			ceiling, qnh, flight_category
		) VALUES (
			$1,$2,$3,$4,$5,$6,
			$7,$8,$9,$10,$11,
			$12,$13,$14
		)`,
		time.Now().UTC(),
		data.ICAOID,
		data.RawOb,
		observationTime,
		data.Temp,
		data.DEWP,
		windDirection,
		int16PtrFromFloat(data.WSpd),
		int16PtrFromFloat(data.WGST),
		visibility,
		cloudsJSON,
		ceiling,
		data.Altim,
		toFlightCategory(data.FLTCat),
	)
	if err != nil {
		return nil, fmt.Errorf("insert metar: %w", err)
	}

	return metarResult{Station: data.ICAOID, Raw: data.RawOb}, nil
}

func fetchMetar(ctx context.Context, client *http.Client, station string) (*aviationWeatherResponse, error) {
	requestURL := fmt.Sprintf("%s?ids=%s&format=json", aviationWeatherBaseURL, url.QueryEscape(station))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return nil, err
	}

	res, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("metar request: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("metar http %d", res.StatusCode)
	}

	var items []aviationWeatherResponse
	if err := json.NewDecoder(res.Body).Decode(&items); err != nil {
		return nil, fmt.Errorf("decode metar: %w", err)
	}
	if len(items) == 0 {
		return nil, fmt.Errorf("no metar data returned for %s", station)
	}
	return &items[0], nil
}

func parseVisibility(value interface{}) *float64 {
	switch typed := value.(type) {
	case float64:
		return &typed
	case string:
		cleaned := strings.ReplaceAll(typed, "+", "")
		if cleaned == "" {
			return nil
		}
		var parsed float64
		_, err := fmt.Sscanf(cleaned, "%f", &parsed)
		if err != nil {
			return nil
		}
		return &parsed
	default:
		return nil
	}
}

func parseWindDirection(value interface{}) *int16 {
	switch typed := value.(type) {
	case float64:
		converted := int16(typed)
		return &converted
	case string:
		if strings.EqualFold(typed, "VRB") || typed == "" {
			return nil
		}
		var parsed int
		_, err := fmt.Sscanf(typed, "%d", &parsed)
		if err != nil {
			return nil
		}
		converted := int16(parsed)
		return &converted
	default:
		return nil
	}
}

func parseCeiling(clouds []aviationCloud) *int32 {
	for _, layer := range clouds {
		if layer.Cover == "BKN" || layer.Cover == "OVC" {
			value := int32(layer.Base)
			return &value
		}
	}
	return nil
}

func toFlightCategory(value string) string {
	switch strings.ToUpper(value) {
	case "MVFR", "IFR", "LIFR":
		return strings.ToUpper(value)
	default:
		return "VFR"
	}
}

func int16PtrFromFloat(value *float64) *int16 {
	if value == nil {
		return nil
	}
	converted := int16(*value)
	return &converted
}
