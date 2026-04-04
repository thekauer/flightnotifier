package jobs

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
)

type trackCandidate struct {
	ICAO24        string
	RequestedTime int64
}

type tracksResult struct {
	Selected int `json:"selected"`
	Inserted int `json:"inserted"`
	Skipped  int `json:"skipped"`
}

func RunTracks(ctx context.Context) (any, error) {
	client := newHTTPClient()
	conn, err := openDB(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Close(ctx)

	candidates, err := selectTrackCandidates(ctx, conn)
	if err != nil {
		return nil, err
	}
	if len(candidates) == 0 {
		return tracksResult{Selected: 0, Inserted: 0, Skipped: 0}, nil
	}

	inserted := 0
	skipped := 0

	for _, candidate := range candidates {
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		track, err := fetchOpenSkyTrack(ctx, client, candidate.ICAO24, candidate.RequestedTime)
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				skipped++
				continue
			}
			skipped++
			if ctx.Err() != nil {
				return nil, err
			}
			continue
		}
		if track == nil {
			skipped++
			continue
		}

		pathJSON, err := mustJSON(track.Path)
		if err != nil {
			return nil, err
		}

		_, err = conn.Exec(
			ctx,
			`INSERT INTO ingest.opensky_tracks (
				fetched_at, icao24, requested_time, start_time, end_time, callsign, path, source
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
			time.Now().UTC(),
			track.ICAO24,
			int32(candidate.RequestedTime),
			int32(track.StartTime),
			int32(track.EndTime),
			trimNullableString(track.Callsign),
			pathJSON,
			"state_vectors",
		)
		if err != nil {
			return nil, fmt.Errorf("insert opensky track: %w", err)
		}

		inserted++
	}

	return tracksResult{
		Selected: len(candidates),
		Inserted: inserted,
		Skipped:  skipped,
	}, nil
}

func selectTrackCandidates(ctx context.Context, conn *pgx.Conn) ([]trackCandidate, error) {
	rows, err := conn.Query(ctx, `
		SELECT icao24, last_contact, time_position, response_time
		FROM ingest.opensky_state_vectors
		WHERE polled_at >= now() - interval '2 hours'
		ORDER BY icao24, last_contact DESC NULLS LAST, time_position DESC NULLS LAST, response_time DESC
		LIMIT 500
	`)
	if err != nil {
		return nil, fmt.Errorf("query track candidates: %w", err)
	}

	candidateMap := make(map[string]int64)
	minTimestamp := time.Now().Unix() - maxTrackAgeSeconds

	for rows.Next() {
		var icao24 string
		var lastContact *int32
		var timePosition *int32
		var responseTime int32
		if err := rows.Scan(&icao24, &lastContact, &timePosition, &responseTime); err != nil {
			return nil, err
		}
		if _, exists := candidateMap[icao24]; exists {
			continue
		}

		requestedTime := int64(responseTime)
		if lastContact != nil {
			requestedTime = int64(*lastContact)
		} else if timePosition != nil {
			requestedTime = int64(*timePosition)
		}
		if requestedTime < minTimestamp {
			continue
		}

		candidateMap[icao24] = requestedTime
		if len(candidateMap) >= trackBatchSize {
			break
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	candidates := make([]trackCandidate, 0, len(candidateMap))
	for icao24, requestedTime := range candidateMap {
		var exists bool
		err := conn.QueryRow(
			ctx,
			`SELECT EXISTS(
				SELECT 1
				FROM ingest.opensky_tracks
				WHERE icao24 = $1
				  AND requested_time BETWEEN $2 AND $3
			)`,
			icao24,
			int32(requestedTime-dedupeWindowSeconds),
			int32(requestedTime+dedupeWindowSeconds),
		).Scan(&exists)
		if err != nil {
			return nil, fmt.Errorf("check track dedupe: %w", err)
		}
		if exists {
			continue
		}
		candidates = append(candidates, trackCandidate{
			ICAO24:        icao24,
			RequestedTime: requestedTime,
		})
	}

	if len(candidates) > trackBatchSize {
		candidates = candidates[:trackBatchSize]
	}
	return candidates, nil
}
