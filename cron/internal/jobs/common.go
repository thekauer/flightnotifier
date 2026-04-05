package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"flightnotifier/cron/internal/shared"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type phaseTimeoutError struct {
	Phase string
	Cause error
}

func (e *phaseTimeoutError) TimeoutMessage() string {
	return e.Error()
}

func (e *phaseTimeoutError) Error() string {
	if e.Cause == nil {
		return e.Phase + " timed out"
	}
	return fmt.Sprintf("%s timed out: %v", e.Phase, e.Cause)
}

func (e *phaseTimeoutError) Unwrap() error {
	return e.Cause
}

const (
	defaultJobTimeout            = 5 * time.Second
	metarJobTimeout              = 6 * time.Second
	flightyJobTimeout            = 6 * time.Second
	adsblolJobTimeout            = 12 * time.Second
	openskyJobTimeout            = 28 * time.Second
	tracksJobTimeout             = 28 * time.Second
	defaultHTTPTimeout           = 3200 * time.Millisecond
	defaultConnectTimeout        = 1200 * time.Millisecond
	defaultTLSHandshakeTimeout   = 1200 * time.Millisecond
	defaultResponseHeaderTimeout = 2200 * time.Millisecond
	metarHTTPTimeout             = 5 * time.Second
	metarConnectTimeout          = 2500 * time.Millisecond
	metarTLSHandshakeTimeout     = 2500 * time.Millisecond
	metarResponseHeaderTimeout   = 4 * time.Second
	adsblolHTTPTimeout           = 6 * time.Second
	adsblolConnectTimeout        = 2500 * time.Millisecond
	adsblolTLSHandshakeTimeout   = 2500 * time.Millisecond
	adsblolResponseHeaderTimeout = 5 * time.Second
	openskyHTTPTimeout           = 25 * time.Second
	openskyConnectTimeout        = 10 * time.Second
	openskyTLSHandshakeTimeout   = 10 * time.Second
	openskyResponseHeaderTimeout = 20 * time.Second
	flightyHTTPTimeout           = 5 * time.Second
	flightyConnectTimeout        = 2500 * time.Millisecond
	flightyTLSHandshakeTimeout   = 2500 * time.Millisecond
	flightyResponseHeaderTimeout = 4 * time.Second
	maxTrackAgeSeconds           = 30 * 24 * 60 * 60
	dedupeWindowSeconds          = 15 * 60
	trackBatchSize               = 10
	adsbdbBatchSize              = 5
	adsbdbMaxCandidates          = 20
	adsblolBaseURL               = "https://api.adsb.lol"
	openskyBaseURL               = "https://opensky-network.org/api"
	openskyAuthURL               = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"
	aviationWeatherBaseURL       = "https://aviationweather.gov/api/data/metar"
	adsbdbBaseURL                = "https://api.adsbdb.com/v0"
	activeAirportWindow          = 5 * time.Minute
)

type monitoredAirport struct {
	Ident              string
	IATA               string
	Name               string
	Latitude           float64
	Longitude          float64
	MetarStation       string
	FlightyArrivalsURL string
}

var defaultMonitoredAirports = []monitoredAirport{
	{Ident: "EHAM", IATA: "AMS", Name: "Amsterdam Airport Schiphol", Latitude: 52.308601, Longitude: 4.76389, MetarStation: "EHAM", FlightyArrivalsURL: "https://flighty.com/airports/amsterdam-schiphol-ams/arrivals"},
	{Ident: "LHBP", IATA: "BUD", Name: "Budapest Liszt Ferenc International Airport", Latitude: 47.43018, Longitude: 19.262393, MetarStation: "LHBP"},
	{Ident: "KATL", IATA: "ATL", Name: "Hartsfield Jackson Atlanta International Airport", Latitude: 33.6367, Longitude: -84.428101, MetarStation: "KATL"},
	{Ident: "OMDB", IATA: "DXB", Name: "Dubai International Airport", Latitude: 25.24979, Longitude: 55.370992, MetarStation: "OMDB"},
	{Ident: "KDFW", IATA: "DFW", Name: "Dallas Fort Worth International Airport", Latitude: 32.896801, Longitude: -97.038002, MetarStation: "KDFW"},
	{Ident: "RJTT", IATA: "HND", Name: "Tokyo Haneda International Airport", Latitude: 35.549678, Longitude: 139.786958, MetarStation: "RJTT"},
	{Ident: "EGLL", IATA: "LHR", Name: "London Heathrow Airport", Latitude: 51.470748, Longitude: -0.459909, MetarStation: "EGLL"},
	{Ident: "KDEN", IATA: "DEN", Name: "Denver International Airport", Latitude: 39.860027, Longitude: -104.673792, MetarStation: "KDEN"},
	{Ident: "LTFM", IATA: "IST", Name: "Istanbul Airport", Latitude: 41.274874, Longitude: 28.732136, MetarStation: "LTFM"},
	{Ident: "KORD", IATA: "ORD", Name: "Chicago O'Hare International Airport", Latitude: 41.9786, Longitude: -87.9048, MetarStation: "KORD"},
	{Ident: "VIDP", IATA: "DEL", Name: "Indira Gandhi International Airport", Latitude: 28.55563, Longitude: 77.09519, MetarStation: "VIDP"},
	{Ident: "ZSPD", IATA: "PVG", Name: "Shanghai Pudong International Airport", Latitude: 31.1434, Longitude: 121.805, MetarStation: "ZSPD"},
	{Ident: "KLAX", IATA: "LAX", Name: "Los Angeles International Airport", Latitude: 33.942501, Longitude: -118.407997, MetarStation: "KLAX"},
	{Ident: "ZGGG", IATA: "CAN", Name: "Guangzhou Baiyun International Airport", Latitude: 23.392401, Longitude: 113.299004, MetarStation: "ZGGG"},
	{Ident: "RKSI", IATA: "ICN", Name: "Incheon International Airport", Latitude: 37.469101, Longitude: 126.450996, MetarStation: "RKSI"},
	{Ident: "LFPG", IATA: "CDG", Name: "Charles de Gaulle International Airport", Latitude: 49.00896, Longitude: 2.554117, MetarStation: "LFPG"},
	{Ident: "WSSS", IATA: "SIN", Name: "Singapore Changi Airport", Latitude: 1.35019, Longitude: 103.994003, MetarStation: "WSSS"},
	{Ident: "ZBAA", IATA: "PEK", Name: "Beijing Capital International Airport", Latitude: 40.077349, Longitude: 116.596702, MetarStation: "ZBAA"},
	{Ident: "LEMD", IATA: "MAD", Name: "Adolfo Suarez Madrid-Barajas Airport", Latitude: 40.493407, Longitude: -3.572249, MetarStation: "LEMD"},
	{Ident: "KJFK", IATA: "JFK", Name: "John F. Kennedy International Airport", Latitude: 40.639447, Longitude: -73.779317, MetarStation: "KJFK"},
	{Ident: "VTBS", IATA: "BKK", Name: "Suvarnabhumi Airport", Latitude: 13.6811, Longitude: 100.747002, MetarStation: "VTBS"},
}

var approachBounds = struct {
	LAMin float64
	LOMin float64
	LAMax float64
	LOMax float64
}{
	LAMin: shared.MustAirportAreaConfig().ReferenceBounds.South,
	LOMin: shared.MustAirportAreaConfig().ReferenceBounds.West,
	LAMax: shared.MustAirportAreaConfig().ReferenceBounds.North,
	LOMax: shared.MustAirportAreaConfig().ReferenceBounds.East,
}

func JobTimeout() time.Duration {
	return defaultJobTimeout
}

func JobTimeoutFor(jobName string) time.Duration {
	switch jobName {
	case "adsblol":
		return adsblolJobTimeout
	case "metar":
		return metarJobTimeout
	case "flighty":
		return flightyJobTimeout
	case "opensky":
		return openskyJobTimeout
	case "tracks":
		return tracksJobTimeout
	default:
		return defaultJobTimeout
	}
}

func newHTTPClient() *http.Client {
	return newConfiguredHTTPClient(
		defaultHTTPTimeout,
		defaultConnectTimeout,
		defaultTLSHandshakeTimeout,
		defaultResponseHeaderTimeout,
	)
}

func newMetarHTTPClient() *http.Client {
	return newConfiguredHTTPClient(
		metarHTTPTimeout,
		metarConnectTimeout,
		metarTLSHandshakeTimeout,
		metarResponseHeaderTimeout,
	)
}

func newAdsbLolHTTPClient() *http.Client {
	return newConfiguredHTTPClient(
		adsblolHTTPTimeout,
		adsblolConnectTimeout,
		adsblolTLSHandshakeTimeout,
		adsblolResponseHeaderTimeout,
	)
}

func newOpenSkyHTTPClient() *http.Client {
	return newConfiguredHTTPClient(
		openskyHTTPTimeout,
		openskyConnectTimeout,
		openskyTLSHandshakeTimeout,
		openskyResponseHeaderTimeout,
	)
}

func newFlightyHTTPClient() *http.Client {
	return newConfiguredHTTPClient(
		flightyHTTPTimeout,
		flightyConnectTimeout,
		flightyTLSHandshakeTimeout,
		flightyResponseHeaderTimeout,
	)
}

func newConfiguredHTTPClient(totalTimeout, connectTimeout, tlsHandshakeTimeout, responseHeaderTimeout time.Duration) *http.Client {
	return &http.Client{
		Timeout: totalTimeout,
		Transport: &http.Transport{
			DialContext: (&net.Dialer{
				Timeout: connectTimeout,
			}).DialContext,
			TLSHandshakeTimeout:   tlsHandshakeTimeout,
			ResponseHeaderTimeout: responseHeaderTimeout,
			IdleConnTimeout:       30 * time.Second,
			MaxIdleConns:          10,
		},
	}
}

func openDB(ctx context.Context) (*pgx.Conn, error) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return nil, errors.New("DATABASE_URL is required")
	}

	conn, err := pgx.Connect(ctx, databaseURL)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return nil, &phaseTimeoutError{Phase: "database connect", Cause: err}
		}
		return nil, fmt.Errorf("connect database: %w", err)
	}

	if _, err := conn.Exec(ctx, "SET statement_timeout = 3500"); err != nil {
		conn.Close(ctx)
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return nil, &phaseTimeoutError{Phase: "database setup", Cause: err}
		}
		return nil, fmt.Errorf("set statement timeout: %w", err)
	}

	return conn, nil
}

func mustJSON(value any) ([]byte, error) {
	if value == nil {
		return nil, nil
	}
	return json.Marshal(value)
}

func parseIntHeader(res *http.Response, name string) int {
	value := res.Header.Get(name)
	if value == "" {
		return 0
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0
	}
	return parsed
}

func newPollUUID() string {
	return uuid.NewString()
}

func resolveMonitoredAirports(ctx context.Context, conn *pgx.Conn) ([]monitoredAirport, error) {
	activeAirports, err := fetchActiveAirports(ctx, conn)
	if err != nil {
		return nil, err
	}

	airports := make([]monitoredAirport, 0, len(defaultMonitoredAirports)+len(activeAirports))
	seen := make(map[string]struct{}, len(defaultMonitoredAirports)+len(activeAirports))

	for _, airport := range defaultMonitoredAirports {
		airports = append(airports, airport)
		seen[airport.Ident] = struct{}{}
	}

	if len(activeAirports) == 0 {
		return airports, nil
	}

	for _, airport := range activeAirports {
		if _, ok := seen[airport.Ident]; ok {
			continue
		}

		airports = append(airports, airport)
		seen[airport.Ident] = struct{}{}
	}

	return airports, nil
}

func fetchActiveAirports(ctx context.Context, conn *pgx.Conn) ([]monitoredAirport, error) {
	rows, err := conn.Query(ctx, `
		SELECT airport_ident, iata, name, latitude, longitude
		FROM public.active_airports
		WHERE touched_at > NOW() - ($1::interval)
		ORDER BY touched_at DESC
	`, fmt.Sprintf("%d seconds", int(activeAirportWindow.Seconds())))
	if err != nil {
		if isMissingRelationError(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("query active airports: %w", err)
	}
	defer rows.Close()

	airports := make([]monitoredAirport, 0)
	for rows.Next() {
		var airport monitoredAirport
		if err := rows.Scan(&airport.Ident, &airport.IATA, &airport.Name, &airport.Latitude, &airport.Longitude); err != nil {
			return nil, fmt.Errorf("scan active airport: %w", err)
		}
		airport.Ident = strings.ToUpper(strings.TrimSpace(airport.Ident))
		airport.IATA = strings.ToUpper(strings.TrimSpace(airport.IATA))
		airport.Name = strings.TrimSpace(airport.Name)
		airport.MetarStation = airport.Ident
		airports = append(airports, airport)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate active airports: %w", err)
	}

	return airports, nil
}

func isMissingRelationError(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "42P01" || pgErr.Code == "42703"
	}
	return false
}
