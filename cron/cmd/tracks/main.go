package main

import (
	"github.com/aws/aws-lambda-go/lambda"

	"flightnotifier/cron/internal/handler"
	"flightnotifier/cron/internal/jobs"
)

func main() {
	lambda.Start(handler.New("tracks", jobs.JobTimeoutFor("tracks"), jobs.RunTracks))
}
