package jobs

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"io"
	"os"
	"strings"
	"testing"
	"time"
)

func TestBuildAdsbLolArchiveKey(t *testing.T) {
	archivedAt := time.Date(2026, time.April, 5, 10, 18, 24, 180000000, time.UTC)
	key := buildAdsbLolArchiveKey("flightnotifier/dev", archivedAt)

	if !strings.HasPrefix(key, "flightnotifier/dev/adsblol/year=2026/month=04/day=05/hour=10/") {
		t.Fatalf("unexpected key prefix: %s", key)
	}
	if !strings.HasSuffix(key, ".json.gz") {
		t.Fatalf("expected gzip json suffix, got %s", key)
	}
}

func TestGzipJSONRoundTrip(t *testing.T) {
	input := adsblolArchivePayload{
		Source:     "adsblol",
		ArchivedAt: time.Date(2026, time.April, 5, 10, 18, 24, 0, time.UTC),
		PollCount:  1,
		Polls: []adsblolArchiveAirportRecord{{
			Airport:       "EHAM",
			QueryRadiusNm: 34,
			RequestURL:    "https://example.invalid",
			UpstreamTotal: 2,
			Response: &adsblolResponse{
				Now:   1,
				Total: 2,
				AC: []map[string]interface{}{
					{"hex": "abc123", "lat": 52.0, "lon": 4.7},
				},
			},
		}},
	}

	body, err := gzipJSON(input)
	if err != nil {
		t.Fatalf("gzipJSON failed: %v", err)
	}

	reader, err := gzip.NewReader(bytes.NewReader(body))
	if err != nil {
		t.Fatalf("gzip reader failed: %v", err)
	}
	defer reader.Close()

	decoded, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("read gzip payload failed: %v", err)
	}

	var roundTrip adsblolArchivePayload
	if err := json.Unmarshal(decoded, &roundTrip); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if roundTrip.Source != input.Source {
		t.Fatalf("expected source %q, got %q", input.Source, roundTrip.Source)
	}
	if roundTrip.PollCount != input.PollCount {
		t.Fatalf("expected poll count %d, got %d", input.PollCount, roundTrip.PollCount)
	}
	if len(roundTrip.Polls) != 1 || roundTrip.Polls[0].Airport != "EHAM" {
		t.Fatalf("unexpected round-trip payload: %#v", roundTrip.Polls)
	}
}

func TestMonthStartUTC(t *testing.T) {
	value := time.Date(2026, time.April, 5, 10, 18, 24, 0, time.FixedZone("CEST", 2*60*60))
	got := monthStartUTC(value)

	expected := time.Date(2026, time.April, 1, 0, 0, 0, 0, time.UTC)
	if !got.Equal(expected) {
		t.Fatalf("expected %s, got %s", expected, got)
	}
}

func TestDayStartUTC(t *testing.T) {
	value := time.Date(2026, time.April, 5, 10, 18, 24, 0, time.FixedZone("CEST", 2*60*60))
	got := dayStartUTC(value)

	expected := time.Date(2026, time.April, 5, 0, 0, 0, 0, time.UTC)
	if !got.Equal(expected) {
		t.Fatalf("expected %s, got %s", expected, got)
	}
}

func TestDeriveDailyArchiveBudget(t *testing.T) {
	monthlyBudget := int64(7 * 1024 * 1024 * 1024)
	day := time.Date(2026, time.February, 12, 10, 0, 0, 0, time.UTC)
	got := deriveDailyArchiveBudget(day, monthlyBudget)

	expected := (monthlyBudget + 27) / 28
	if got != expected {
		t.Fatalf("expected %d, got %d", expected, got)
	}
}

func TestReadInt64Env(t *testing.T) {
	t.Setenv("R2_ARCHIVE_MAX_BYTES_PER_MONTH", "123")
	value, err := readInt64Env("R2_ARCHIVE_MAX_BYTES_PER_MONTH", 0)
	if err != nil {
		t.Fatalf("readInt64Env returned error: %v", err)
	}
	if value != 123 {
		t.Fatalf("expected 123, got %d", value)
	}

	t.Setenv("R2_ARCHIVE_MAX_BYTES_PER_MONTH", "")
	value, err = readInt64Env("R2_ARCHIVE_MAX_BYTES_PER_MONTH", 456)
	if err != nil {
		t.Fatalf("readInt64Env fallback returned error: %v", err)
	}
	if value != 456 {
		t.Fatalf("expected fallback 456, got %d", value)
	}
}

func TestReadInt64EnvRejectsInvalidValues(t *testing.T) {
	key := "R2_ARCHIVE_MAX_OBJECTS_PER_MONTH"
	original := os.Getenv(key)
	t.Cleanup(func() {
		if original == "" {
			_ = os.Unsetenv(key)
			return
		}
		_ = os.Setenv(key, original)
	})

	_ = os.Setenv(key, "-1")
	if _, err := readInt64Env(key, 0); err == nil {
		t.Fatalf("expected invalid negative value to fail")
	}
}

func TestReadR2ArchiveConfigDefaultsToSevenGiBMonthlyAndDerivedDailyCap(t *testing.T) {
	t.Setenv("R2_ARCHIVE_ENABLED", "true")
	t.Setenv("R2_ACCOUNT_ID", "account")
	t.Setenv("R2_ACCESS_KEY_ID", "access")
	t.Setenv("R2_SECRET_ACCESS_KEY", "secret")
	t.Setenv("R2_BUCKET", "bucket")
	t.Setenv("R2_PREFIX", "prefix")
	t.Setenv("R2_ARCHIVE_MAX_BYTES_PER_MONTH", "")
	t.Setenv("R2_ARCHIVE_MAX_BYTES_PER_DAY", "")
	t.Setenv("R2_ARCHIVE_MAX_OBJECT_BYTES", "")

	cfg, enabled, err := readR2ArchiveConfig()
	if err != nil {
		t.Fatalf("readR2ArchiveConfig returned error: %v", err)
	}
	if !enabled {
		t.Fatalf("expected archiving to be enabled")
	}
	if cfg.MaxBytesPerMonth != defaultArchiveMaxBytesPerMonth {
		t.Fatalf("expected default monthly budget %d, got %d", defaultArchiveMaxBytesPerMonth, cfg.MaxBytesPerMonth)
	}
	expectedDaily := deriveDailyArchiveBudget(time.Now().UTC(), defaultArchiveMaxBytesPerMonth)
	if cfg.MaxBytesPerDay != expectedDaily {
		t.Fatalf("expected derived daily budget %d, got %d", expectedDaily, cfg.MaxBytesPerDay)
	}
	if cfg.MaxBytesPerObject != expectedDaily {
		t.Fatalf("expected object cap to default to daily budget %d, got %d", expectedDaily, cfg.MaxBytesPerObject)
	}
}

func TestFilterArchivePollsToDefaultAirports(t *testing.T) {
	polls := []adsblolAirportPoll{
		{Airport: adsblolAirportConfig{Ident: "EHAM"}},
		{Airport: adsblolAirportConfig{Ident: "KPDX"}},
		{Airport: adsblolAirportConfig{Ident: "KJFK"}},
	}

	filtered := filterArchivePollsToDefaultAirports(polls)
	if len(filtered) != 2 {
		t.Fatalf("expected 2 always-on airport polls, got %d", len(filtered))
	}
	if filtered[0].Airport.Ident != "EHAM" || filtered[1].Airport.Ident != "KJFK" {
		t.Fatalf("unexpected filtered airports: %#v", filtered)
	}
}
