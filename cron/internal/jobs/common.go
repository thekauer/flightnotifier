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
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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
	metarStation                 = "EHAM"
	flightyURL                   = "https://flighty.com/airports/amsterdam-schiphol-ams/arrivals"
	adsblolBaseURL               = "https://api.adsb.lol"
	openskyBaseURL               = "https://opensky-network.org/api"
	openskyAuthURL               = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"
	aviationWeatherBaseURL       = "https://aviationweather.gov/api/data/metar"
	adsbdbBaseURL                = "https://api.adsbdb.com/v0"
)

var approachBounds = struct {
	LAMin float64
	LOMin float64
	LAMax float64
	LOMax float64
}{
	LAMin: 52.13,
	LOMin: 4.46,
	LAMax: 52.52,
	LOMax: 5.24,
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
