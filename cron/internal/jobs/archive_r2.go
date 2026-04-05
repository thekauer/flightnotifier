package jobs

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/jackc/pgx/v5"
)

type adsblolArchiveAirportRecord struct {
	Airport       string           `json:"airport"`
	QueryRadiusNm int              `json:"queryRadiusNm"`
	RequestURL    string           `json:"requestUrl"`
	UpstreamTotal int              `json:"upstreamTotal"`
	Response      *adsblolResponse `json:"response"`
}

type adsblolArchivePayload struct {
	Source     string                        `json:"source"`
	ArchivedAt time.Time                     `json:"archivedAt"`
	PollCount  int                           `json:"pollCount"`
	Polls      []adsblolArchiveAirportRecord `json:"polls"`
}

type r2ArchiveConfig struct {
	AccountID          string
	AccessKey          string
	SecretKey          string
	Bucket             string
	Prefix             string
	MaxBytesPerMonth   int64
	MaxObjectsPerMonth int64
	MaxTotalBytes      int64
}

var (
	r2ClientOnce          sync.Once
	r2Client              *s3.Client
	r2ClientErr           error
	archiveUsageTableOnce sync.Once
	archiveUsageTableErr  error
)

func readR2ArchiveConfig() (*r2ArchiveConfig, bool, error) {
	enabled := strings.EqualFold(strings.TrimSpace(os.Getenv("R2_ARCHIVE_ENABLED")), "true")
	if !enabled {
		return nil, false, nil
	}

	cfg := &r2ArchiveConfig{
		AccountID: strings.TrimSpace(os.Getenv("R2_ACCOUNT_ID")),
		AccessKey: strings.TrimSpace(os.Getenv("R2_ACCESS_KEY_ID")),
		SecretKey: strings.TrimSpace(os.Getenv("R2_SECRET_ACCESS_KEY")),
		Bucket:    strings.TrimSpace(os.Getenv("R2_BUCKET")),
		Prefix:    strings.Trim(strings.TrimSpace(os.Getenv("R2_PREFIX")), "/"),
	}
	maxBytes, err := readInt64Env("R2_ARCHIVE_MAX_BYTES_PER_MONTH", 0)
	if err != nil {
		return nil, false, err
	}
	maxObjects, err := readInt64Env("R2_ARCHIVE_MAX_OBJECTS_PER_MONTH", 0)
	if err != nil {
		return nil, false, err
	}
	maxTotalBytes, err := readInt64Env("R2_ARCHIVE_MAX_TOTAL_BYTES", 0)
	if err != nil {
		return nil, false, err
	}
	cfg.MaxBytesPerMonth = maxBytes
	cfg.MaxObjectsPerMonth = maxObjects
	cfg.MaxTotalBytes = maxTotalBytes

	switch {
	case cfg.AccountID == "":
		return nil, false, fmt.Errorf("R2_ACCOUNT_ID is required when R2 archiving is enabled")
	case cfg.AccessKey == "":
		return nil, false, fmt.Errorf("R2_ACCESS_KEY_ID is required when R2 archiving is enabled")
	case cfg.SecretKey == "":
		return nil, false, fmt.Errorf("R2_SECRET_ACCESS_KEY is required when R2 archiving is enabled")
	case cfg.Bucket == "":
		return nil, false, fmt.Errorf("R2_BUCKET is required when R2 archiving is enabled")
	}

	return cfg, true, nil
}

func readInt64Env(name string, fallback int64) (int64, error) {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return fallback, nil
	}

	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value < 0 {
		return 0, fmt.Errorf("%s must be a non-negative integer", name)
	}

	return value, nil
}

func getR2Client(ctx context.Context, archiveCfg *r2ArchiveConfig) (*s3.Client, error) {
	r2ClientOnce.Do(func() {
		endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", archiveCfg.AccountID)
		cfg, err := awsconfig.LoadDefaultConfig(
			ctx,
			awsconfig.WithRegion("auto"),
			awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(archiveCfg.AccessKey, archiveCfg.SecretKey, "")),
			awsconfig.WithBaseEndpoint(endpoint),
		)
		if err != nil {
			r2ClientErr = fmt.Errorf("load R2 config: %w", err)
			return
		}

		r2Client = s3.NewFromConfig(cfg, func(options *s3.Options) {
			options.UsePathStyle = true
		})
	})

	if r2ClientErr != nil {
		return nil, r2ClientErr
	}
	return r2Client, nil
}

func buildAdsbLolArchiveKey(prefix string, archivedAt time.Time) string {
	segments := []string{}
	if prefix != "" {
		segments = append(segments, prefix)
	}

	segments = append(
		segments,
		"adsblol",
		fmt.Sprintf("year=%04d", archivedAt.UTC().Year()),
		fmt.Sprintf("month=%02d", archivedAt.UTC().Month()),
		fmt.Sprintf("day=%02d", archivedAt.UTC().Day()),
		fmt.Sprintf("hour=%02d", archivedAt.UTC().Hour()),
		fmt.Sprintf("adsblol-%s.json.gz", archivedAt.UTC().Format("20060102T150405.000Z")),
	)

	return path.Join(segments...)
}

func gzipJSON(value any) ([]byte, error) {
	var raw bytes.Buffer
	encoder := json.NewEncoder(&raw)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return nil, err
	}

	var compressed bytes.Buffer
	writer, err := gzip.NewWriterLevel(&compressed, gzip.BestSpeed)
	if err != nil {
		return nil, err
	}

	if _, err := writer.Write(raw.Bytes()); err != nil {
		writer.Close()
		return nil, err
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}

	return compressed.Bytes(), nil
}

func archiveAdsbLolPolls(ctx context.Context, conn *pgx.Conn, archivedAt time.Time, polls []adsblolAirportPoll) (string, error) {
	archiveCfg, enabled, err := readR2ArchiveConfig()
	if err != nil {
		return "", err
	}
	if !enabled || len(polls) == 0 {
		return "", nil
	}

	records := make([]adsblolArchiveAirportRecord, 0, len(polls))
	for _, poll := range polls {
		records = append(records, adsblolArchiveAirportRecord{
			Airport:       poll.Airport.Ident,
			QueryRadiusNm: poll.QueryRadius,
			RequestURL:    poll.RequestURL,
			UpstreamTotal: poll.UpstreamTotal,
			Response:      poll.Raw,
		})
	}

	payload := adsblolArchivePayload{
		Source:     "adsblol",
		ArchivedAt: archivedAt.UTC(),
		PollCount:  len(records),
		Polls:      records,
	}

	body, err := gzipJSON(payload)
	if err != nil {
		return "", fmt.Errorf("encode adsblol archive: %w", err)
	}

	if conn != nil {
		allowed, err := reserveArchiveBudget(ctx, conn, archiveCfg, "adsblol", archivedAt, int64(len(body)))
		if err != nil {
			return "", err
		}
		if !allowed {
			log.Printf("[cron/adsblol] skipped R2 archive upload because monthly cap would be exceeded")
			return "", nil
		}
	}

	client, err := getR2Client(ctx, archiveCfg)
	if err != nil {
		return "", err
	}

	if err := enforceRollingArchiveCap(ctx, client, archiveCfg, "adsblol", int64(len(body))); err != nil {
		return "", err
	}

	key := buildAdsbLolArchiveKey(archiveCfg.Prefix, archivedAt)
	_, err = client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:          &archiveCfg.Bucket,
		Key:             &key,
		Body:            bytes.NewReader(body),
		ContentType:     awsString("application/json"),
		ContentEncoding: awsString("gzip"),
	})
	if err != nil {
		if conn != nil {
			if releaseErr := releaseArchiveBudget(ctx, conn, "adsblol", archivedAt, int64(len(body))); releaseErr != nil {
				log.Printf("[cron/adsblol] failed to release reserved archive budget after upload error: %v", releaseErr)
			}
		}
		return "", fmt.Errorf("upload adsblol archive: %w", err)
	}

	return key, nil
}

func awsString(value string) *string {
	return &value
}

type archiveObjectInfo struct {
	Key          string
	Size         int64
	LastModified time.Time
}

func archiveSourcePrefix(prefix string, source string) string {
	base := strings.Trim(prefix, "/")
	if base == "" {
		return source + "/"
	}
	return path.Join(base, source) + "/"
}

func listArchiveObjects(ctx context.Context, client *s3.Client, archiveCfg *r2ArchiveConfig, source string) ([]archiveObjectInfo, int64, error) {
	objects := make([]archiveObjectInfo, 0)
	var totalBytes int64
	prefix := archiveSourcePrefix(archiveCfg.Prefix, source)
	var continuationToken *string

	for {
		output, err := client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
			Bucket:            &archiveCfg.Bucket,
			Prefix:            &prefix,
			ContinuationToken: continuationToken,
		})
		if err != nil {
			return nil, 0, fmt.Errorf("list archive objects: %w", err)
		}

		for _, object := range output.Contents {
			if object.Key == nil {
				continue
			}
			item := archiveObjectInfo{
				Key: *object.Key,
			}
			if object.Size != nil {
				item.Size = *object.Size
			}
			if object.LastModified != nil {
				item.LastModified = *object.LastModified
			}
			objects = append(objects, item)
			totalBytes += item.Size
		}

		if output.IsTruncated == nil || !*output.IsTruncated {
			break
		}
		continuationToken = output.NextContinuationToken
	}

	return objects, totalBytes, nil
}

func enforceRollingArchiveCap(ctx context.Context, client *s3.Client, archiveCfg *r2ArchiveConfig, source string, incomingBytes int64) error {
	if archiveCfg.MaxTotalBytes <= 0 {
		return nil
	}
	if incomingBytes > archiveCfg.MaxTotalBytes {
		return fmt.Errorf("archive object of %d bytes exceeds configured total cap of %d bytes", incomingBytes, archiveCfg.MaxTotalBytes)
	}

	objects, totalBytes, err := listArchiveObjects(ctx, client, archiveCfg, source)
	if err != nil {
		return err
	}
	if totalBytes+incomingBytes <= archiveCfg.MaxTotalBytes {
		return nil
	}

	sortArchiveObjectsOldestFirst(objects)

	bytesNeeded := totalBytes + incomingBytes - archiveCfg.MaxTotalBytes
	deletedBytes := int64(0)

	for _, object := range objects {
		if deletedBytes >= bytesNeeded {
			break
		}

		_, err := client.DeleteObject(ctx, &s3.DeleteObjectInput{
			Bucket: &archiveCfg.Bucket,
			Key:    awsString(object.Key),
		})
		if err != nil {
			return fmt.Errorf("delete old archive object %s: %w", object.Key, err)
		}
		deletedBytes += object.Size
	}

	if deletedBytes < bytesNeeded {
		return fmt.Errorf("unable to free enough archive space: needed %d bytes, deleted %d bytes", bytesNeeded, deletedBytes)
	}

	return nil
}

func sortArchiveObjectsOldestFirst(objects []archiveObjectInfo) {
	sort.Slice(objects, func(i, j int) bool {
		left := objects[i]
		right := objects[j]
		if left.LastModified.Equal(right.LastModified) {
			return left.Key < right.Key
		}
		return left.LastModified.Before(right.LastModified)
	})
}

func monthStartUTC(value time.Time) time.Time {
	utc := value.UTC()
	return time.Date(utc.Year(), utc.Month(), 1, 0, 0, 0, 0, time.UTC)
}

func ensureArchiveUsageTable(ctx context.Context, conn *pgx.Conn) error {
	archiveUsageTableOnce.Do(func() {
		_, archiveUsageTableErr = conn.Exec(ctx, `
			CREATE TABLE IF NOT EXISTS public.archive_usage_monthly (
				source text NOT NULL,
				month_start timestamp with time zone NOT NULL,
				object_count bigint NOT NULL DEFAULT 0,
				total_bytes bigint NOT NULL DEFAULT 0,
				updated_at timestamp with time zone NOT NULL DEFAULT now(),
				PRIMARY KEY (source, month_start)
			)
		`)
	})

	return archiveUsageTableErr
}

func reserveArchiveBudget(ctx context.Context, conn *pgx.Conn, archiveCfg *r2ArchiveConfig, source string, archivedAt time.Time, objectBytes int64) (bool, error) {
	if archiveCfg.MaxBytesPerMonth == 0 && archiveCfg.MaxObjectsPerMonth == 0 {
		return true, nil
	}
	if err := ensureArchiveUsageTable(ctx, conn); err != nil {
		return false, fmt.Errorf("ensure archive usage table: %w", err)
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		return false, fmt.Errorf("begin archive budget transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	monthStart := monthStartUTC(archivedAt)
	if _, err := tx.Exec(ctx, `
		INSERT INTO public.archive_usage_monthly (source, month_start, object_count, total_bytes, updated_at)
		VALUES ($1, $2, 0, 0, now())
		ON CONFLICT (source, month_start) DO NOTHING
	`, source, monthStart); err != nil {
		return false, fmt.Errorf("seed archive usage row: %w", err)
	}

	var currentObjects int64
	var currentBytes int64
	if err := tx.QueryRow(ctx, `
		SELECT object_count, total_bytes
		FROM public.archive_usage_monthly
		WHERE source = $1 AND month_start = $2
		FOR UPDATE
	`, source, monthStart).Scan(&currentObjects, &currentBytes); err != nil {
		return false, fmt.Errorf("lock archive usage row: %w", err)
	}

	nextObjects := currentObjects + 1
	nextBytes := currentBytes + objectBytes
	if archiveCfg.MaxObjectsPerMonth > 0 && nextObjects > archiveCfg.MaxObjectsPerMonth {
		return false, nil
	}
	if archiveCfg.MaxBytesPerMonth > 0 && nextBytes > archiveCfg.MaxBytesPerMonth {
		return false, nil
	}

	if _, err := tx.Exec(ctx, `
		UPDATE public.archive_usage_monthly
		SET object_count = $3,
		    total_bytes = $4,
		    updated_at = now()
		WHERE source = $1 AND month_start = $2
	`, source, monthStart, nextObjects, nextBytes); err != nil {
		return false, fmt.Errorf("reserve archive budget: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return false, fmt.Errorf("commit archive budget reservation: %w", err)
	}

	return true, nil
}

func releaseArchiveBudget(ctx context.Context, conn *pgx.Conn, source string, archivedAt time.Time, objectBytes int64) error {
	if err := ensureArchiveUsageTable(ctx, conn); err != nil {
		return fmt.Errorf("ensure archive usage table: %w", err)
	}

	monthStart := monthStartUTC(archivedAt)
	_, err := conn.Exec(ctx, `
		UPDATE public.archive_usage_monthly
		SET object_count = GREATEST(object_count - 1, 0),
		    total_bytes = GREATEST(total_bytes - $3, 0),
		    updated_at = now()
		WHERE source = $1 AND month_start = $2
	`, source, monthStart, objectBytes)
	if err != nil {
		return fmt.Errorf("release archive budget: %w", err)
	}

	return nil
}
