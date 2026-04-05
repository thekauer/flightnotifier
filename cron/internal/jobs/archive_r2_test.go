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
