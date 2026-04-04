package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"flightnotifier/cron/internal/handler"
	"flightnotifier/cron/internal/jobs"
)

type scheduleEntry struct {
	jobName  string
	interval time.Duration
}

var defaultWatchSchedule = []scheduleEntry{
	{jobName: "adsblol", interval: 30 * time.Second},
	{jobName: "flighty", interval: 45 * time.Second},
	{jobName: "metar", interval: 60 * time.Second},
	{jobName: "opensky", interval: 2 * time.Minute},
	{jobName: "adsbdb", interval: 2 * time.Minute},
	{jobName: "tracks", interval: 3 * time.Minute},
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: go run ./cron/cmd/local <job|all> [--watch]")
		os.Exit(1)
	}

	jobName := os.Args[1]
	watch := false
	for _, arg := range os.Args[2:] {
		if arg == "--watch" {
			watch = true
		}
	}

	if jobName == "all" && watch {
		runContinuously(defaultWatchSchedule)
		return
	}

	if !watch {
		if err := runOnce(jobName); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}

	runContinuously([]scheduleEntry{{
		jobName:  jobName,
		interval: 30 * time.Second,
	}})
}

func runOnce(jobName string) error {
	run := jobs.RunByName(jobName)
	response, err := handler.New(jobName, jobs.JobTimeoutFor(jobName), run)(context.Background(), handler.Event{Job: jobName})
	if err != nil {
		return err
	}

	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(response); err != nil {
		return err
	}

	return nil
}

func runContinuously(entries []scheduleEntry) {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	fmt.Printf("starting local cron watch for %s\n", formatEntries(entries))

	for _, entry := range entries {
		runScheduledJob(ctx, entry)
	}

	<-ctx.Done()
	fmt.Fprintln(os.Stdout, "local cron watch stopped")
}

func runScheduledJob(ctx context.Context, entry scheduleEntry) {
	go func() {
		runAndLog(entry.jobName)

		ticker := time.NewTicker(entry.interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				runAndLog(entry.jobName)
			}
		}
	}()
}

func runAndLog(jobName string) {
	fmt.Printf("[%s] running %s\n", time.Now().Format(time.RFC3339), jobName)
	if err := runOnce(jobName); err != nil {
		fmt.Fprintf(os.Stderr, "[%s] %s failed: %v\n", time.Now().Format(time.RFC3339), jobName, err)
	}
}

func formatEntries(entries []scheduleEntry) string {
	parts := make([]string, 0, len(entries))
	for _, entry := range entries {
		parts = append(parts, fmt.Sprintf("%s every %s", entry.jobName, entry.interval))
	}
	return strings.Join(parts, ", ")
}
