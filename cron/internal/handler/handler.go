package handler

import (
	"context"
	"errors"
	"log"
	"os"
	"time"
)

type Event struct {
	Job string `json:"job,omitempty"`
}

type Runner func(context.Context) (any, error)

type Response struct {
	OK         bool      `json:"ok"`
	Job        string    `json:"job"`
	InvokedAt  time.Time `json:"invokedAt"`
	DurationMS int64     `json:"durationMs"`
	Stage      string    `json:"stage"`
	Result     any       `json:"result,omitempty"`
	Error      string    `json:"error,omitempty"`
}

func New(jobName string, timeout time.Duration, run Runner) func(context.Context, Event) (Response, error) {
	return func(parent context.Context, event Event) (Response, error) {
		startedAt := time.Now().UTC()
		stage := os.Getenv("APP_ENV")
		if stage == "" {
			stage = "dev"
		}

		ctx, cancel := context.WithTimeout(parent, timeout)
		defer cancel()

		result, runErr := run(ctx)
		durationMS := time.Since(startedAt).Milliseconds()

		if runErr != nil {
			errText := runErr.Error()
			var phaseErr interface{ TimeoutMessage() string }
			if errors.As(runErr, &phaseErr) {
				errText = phaseErr.TimeoutMessage()
			} else if errors.Is(runErr, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
				errText = "job timed out before completion"
			}

			log.Printf("[cron/%s] failed stage=%s event_job=%s duration_ms=%d error=%s", jobName, stage, event.Job, durationMS, errText)

			return Response{
				OK:         false,
				Job:        jobName,
				InvokedAt:  startedAt,
				DurationMS: durationMS,
				Stage:      stage,
				Error:      errText,
			}, nil
		}

		log.Printf("[cron/%s] completed stage=%s event_job=%s duration_ms=%d", jobName, stage, event.Job, durationMS)

		return Response{
			OK:         true,
			Job:        jobName,
			InvokedAt:  startedAt,
			DurationMS: durationMS,
			Stage:      stage,
			Result:     result,
		}, nil
	}
}
