package jobs

import (
	"context"
	"log"
)

type batchStepResult struct {
	Name   string `json:"name"`
	OK     bool   `json:"ok"`
	Result any    `json:"result,omitempty"`
	Error  string `json:"error,omitempty"`
}

type batchResult struct {
	OK    bool              `json:"ok"`
	Steps []batchStepResult `json:"steps"`
}

func RunBatch(ctx context.Context) (any, error) {
	steps := []struct {
		name string
		run  func(context.Context) (any, error)
	}{
		{name: "opensky", run: RunOpenSky},
		{name: "metar", run: RunMetar},
		{name: "flighty", run: RunFlighty},
		{name: "adsbdb", run: RunAdsbdb},
		{name: "tracks", run: RunTracks},
	}

	results := make([]batchStepResult, 0, len(steps))
	allOK := true

	for _, step := range steps {
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		result, err := step.run(ctx)
		if err != nil {
			allOK = false
			log.Printf("[cron/batch] step failed name=%s error=%v", step.name, err)
			results = append(results, batchStepResult{
				Name:  step.name,
				OK:    false,
				Error: err.Error(),
			})
			continue
		}

		results = append(results, batchStepResult{
			Name:   step.name,
			OK:     true,
			Result: result,
		})
	}

	return batchResult{
		OK:    allOK,
		Steps: results,
	}, nil
}
