package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type flightyArrivalRow struct {
	ID              string                   `json:"id"`
	City            string                   `json:"city"`
	Status          []map[string]interface{} `json:"status"`
	OriginalTime    map[string]interface{}   `json:"originalTime"`
	NewTime         map[string]interface{}   `json:"newTime"`
	SecondaryCorner *string                  `json:"secondaryCorner"`
	Airline         struct {
		ID   string `json:"id"`
		IATA string `json:"iata"`
		Name string `json:"name"`
	} `json:"airline"`
	FlightNumber string                 `json:"flightNumber"`
	Departure    map[string]interface{} `json:"departure"`
	Arrival      map[string]interface{} `json:"arrival"`
}

type flightyResult struct {
	Inserted int `json:"inserted"`
}

func RunFlighty(ctx context.Context) (any, error) {
	client := newFlightyHTTPClient()
	conn, err := openDB(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Close(ctx)

	rows, err := fetchFlightyRows(ctx, client)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return flightyResult{Inserted: 0}, nil
	}

	scrapedAt := time.Now().UTC()
	batch := &pgx.Batch{}

	for _, row := range rows {
		statusJSON, err := mustJSON(row.Status)
		if err != nil {
			return nil, err
		}
		originalJSON, err := mustJSON(row.OriginalTime)
		if err != nil {
			return nil, err
		}
		newJSON, err := mustJSON(row.NewTime)
		if err != nil {
			return nil, err
		}
		departureJSON, err := mustJSON(row.Departure)
		if err != nil {
			return nil, err
		}
		arrivalJSON, err := mustJSON(row.Arrival)
		if err != nil {
			return nil, err
		}

		batch.Queue(
			`INSERT INTO ingest.flighty_arrivals (
				scraped_at, flight_id, flight_number, airline_iata, airline_name,
				city, status, original_time, new_time, departure, arrival, secondary_corner
			) VALUES (
				$1,$2,$3,$4,$5,
				$6,$7,$8,$9,$10,$11,$12
			)`,
			scrapedAt,
			row.ID,
			row.FlightNumber,
			nullableString(row.Airline.IATA),
			nullableString(row.Airline.Name),
			nullableString(row.City),
			statusJSON,
			originalJSON,
			newJSON,
			departureJSON,
			arrivalJSON,
			row.SecondaryCorner,
		)
	}

	results := conn.SendBatch(ctx, batch)
	for i := 0; i < len(rows); i++ {
		if _, err := results.Exec(); err != nil {
			results.Close()
			return nil, fmt.Errorf("insert flighty rows: %w", err)
		}
	}
	if err := results.Close(); err != nil {
		return nil, err
	}

	return flightyResult{Inserted: len(rows)}, nil
}

func fetchFlightyRows(ctx context.Context, client *http.Client) ([]flightyArrivalRow, error) {
	flightyURL := ""
	for _, airport := range monitoredAirports {
		if airport.FlightyArrivalsURL != "" {
			flightyURL = airport.FlightyArrivalsURL
			break
		}
	}
	if flightyURL == "" {
		return nil, nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, flightyURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "text/html,application/xhtml+xml")
	req.Header.Set("User-Agent", "FlightNotifier/1.0 (+https://github.com; schedule reader)")

	res, err := client.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return nil, &phaseTimeoutError{Phase: "flighty request", Cause: err}
		}
		return nil, fmt.Errorf("flighty request: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("flighty http %d", res.StatusCode)
	}

	body, err := io.ReadAll(res.Body)
	if err != nil {
		if ctx.Err() != nil {
			return nil, &phaseTimeoutError{Phase: "flighty response read", Cause: err}
		}
		return nil, fmt.Errorf("read flighty response: %w", err)
	}

	return extractInitialFlightsFromHTML(string(body))
}

func extractInitialFlightsFromHTML(html string) ([]flightyArrivalRow, error) {
	const initialMarker = "initialFlights"

	mi := strings.Index(html, initialMarker)
	if mi < 0 {
		return nil, nil
	}

	bracket := strings.Index(html[mi:], "[")
	if bracket < 0 {
		return nil, nil
	}
	bracket += mi

	endIndex := findJSONArrayEnd(html, bracket)
	if endIndex < 0 {
		return nil, nil
	}

	slice := html[bracket : endIndex+1]
	jsonText := strings.ReplaceAll(slice, "\\\"", "\"")

	var rows []flightyArrivalRow
	if err := json.Unmarshal([]byte(jsonText), &rows); err != nil {
		return nil, err
	}
	return rows, nil
}

func findJSONArrayEnd(input string, start int) int {
	depth := 0
	inString := false
	escaped := false

	for i := start; i < len(input); i++ {
		char := input[i]

		if escaped {
			escaped = false
			continue
		}

		if char == '\\' {
			escaped = true
			continue
		}

		if char == '"' {
			inString = !inString
			continue
		}

		if inString {
			continue
		}

		switch char {
		case '[':
			depth++
		case ']':
			depth--
			if depth == 0 {
				return i
			}
		}
	}

	return -1
}
