package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
)

type aviationWeatherResponse struct {
	ICAOID  string          `json:"icaoId"`
	RawOb   string          `json:"rawOb"`
	ObsTime int64           `json:"obsTime"`
	Temp    *float64        `json:"temp"`
	DEWP    *float64        `json:"dewp"`
	WDir    interface{}     `json:"wdir"`
	WSpd    *float64        `json:"wspd"`
	WGST    *float64        `json:"wgst"`
	Visib   interface{}     `json:"visib"`
	Clouds  []aviationCloud `json:"clouds"`
	Altim   *float64        `json:"altim"`
	FLTCat  string          `json:"fltCat"`
}

type aviationCloud struct {
	Cover string `json:"cover"`
	Base  int    `json:"base"`
}

type metarResult struct {
	Inserted int                  `json:"inserted"`
	Stations []metarStationResult `json:"stations"`
}

type metarStationResult struct {
	Airport string `json:"airport"`
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

	items, err := fetchMetars(ctx, client)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return metarResult{Inserted: 0, Stations: nil}, nil
	}

	fetchedAt := time.Now().UTC()
	batch := &pgx.Batch{}
	results := make([]metarStationResult, 0, len(items))
	for _, item := range items {
		cloudsJSON, err := mustJSON(item.Data.Clouds)
		if err != nil {
			return nil, fmt.Errorf("%s encode metar clouds: %w", item.Airport.Ident, err)
		}

		observationTime := time.Unix(item.Data.ObsTime, 0).UTC()
		windDirection := parseWindDirection(item.Data.WDir)
		visibility := parseVisibility(item.Data.Visib)
		ceiling := parseCeiling(item.Data.Clouds)

		batch.Queue(
			`INSERT INTO ingest.metar (
				fetched_at, station, raw, observation_time, temp, dewpoint,
				wind_direction, wind_speed, wind_gust, visibility, clouds,
				ceiling, qnh, flight_category
			) VALUES (
				$1,$2,$3,$4,$5,$6,
				$7,$8,$9,$10,$11,
				$12,$13,$14
			)`,
			fetchedAt,
			item.Data.ICAOID,
			item.Data.RawOb,
			observationTime,
			item.Data.Temp,
			item.Data.DEWP,
			windDirection,
			int16PtrFromFloat(item.Data.WSpd),
			int16PtrFromFloat(item.Data.WGST),
			visibility,
			cloudsJSON,
			ceiling,
			item.Data.Altim,
			toFlightCategory(item.Data.FLTCat),
		)

		results = append(results, metarStationResult{
			Airport: item.Airport.Ident,
			Station: item.Data.ICAOID,
			Raw:     item.Data.RawOb,
		})
	}

	batchResults := conn.SendBatch(ctx, batch)
	for i := 0; i < len(items); i++ {
		if _, err := batchResults.Exec(); err != nil {
			batchResults.Close()
			return nil, fmt.Errorf("insert metar rows: %w", err)
		}
	}
	if err := batchResults.Close(); err != nil {
		return nil, fmt.Errorf("close metar batch: %w", err)
	}

	return metarResult{Inserted: len(results), Stations: results}, nil
}

type metarFetchResult struct {
	Airport monitoredAirport
	Data    *aviationWeatherResponse
}

func fetchMetars(ctx context.Context, client *http.Client) ([]metarFetchResult, error) {
	airports := make([]monitoredAirport, 0, len(monitoredAirports))
	for _, airport := range monitoredAirports {
		if airport.MetarStation != "" {
			airports = append(airports, airport)
		}
	}

	results := make([]metarFetchResult, len(airports))
	errs := make([]error, len(airports))

	var wg sync.WaitGroup
	for i, airport := range airports {
		wg.Add(1)
		go func(index int, airport monitoredAirport) {
			defer wg.Done()

			data, err := fetchMetar(ctx, client, airport.MetarStation)
			if err != nil {
				errs[index] = fmt.Errorf("%s metar fetch failed: %w", airport.Ident, err)
				return
			}
			results[index] = metarFetchResult{Airport: airport, Data: data}
		}(i, airport)
	}

	wg.Wait()

	var messages []string
	for _, err := range errs {
		if err != nil {
			messages = append(messages, err.Error())
		}
	}
	if len(messages) > 0 {
		return nil, errors.New(strings.Join(messages, "; "))
	}

	return results, nil
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
