# Go Cron Scaffolding

This folder now contains the Go-based AWS Lambda cron scaffold for FlightNotifier.

## Layout

- `cmd/<job>/main.go`: one Lambda entrypoint per cron job
- `internal/handler`: shared Lambda handler used by all jobs for now

## Current status

The scaffold is deployment-ready but intentionally minimal. Each function logs its invocation and returns a structured response so the AWS infrastructure can be stood up before porting the actual ingestion logic from the previous TypeScript cron implementation.

## Deploy

From the repo root:

```bash
bun run aws:cron:deploy
```

The AWS cron commands automatically source `.env.cron` when it exists.

## Local development

Run a single job once:

```bash
bun run aws:cron:local adsblol
```

Run the local dev scheduler continuously against your dev database:

```bash
bun run aws:cron:watch
```

This starts a lightweight local loop for `adsblol`, `flighty`, `metar`, `opensky`, `adsbdb`, and `tracks`, with short intervals so the app can read fresh rows from the dev DB while you test the DB-backed API routes.

Typical flow:

```bash
cp .env.cron.example .env.cron
bun run aws:cron:print
bun run aws:cron:deploy
```

Required values in `.env.cron` before deploy:

- `AWS_REGION`
- `AWS_ENABLE_BUDGET_ALERTS`
- `AWS_CRON_BUDGET_ALERT_EMAIL`
- `AWS_CRON_BUDGET_LIMIT_USD`
- `OPENSKY_CLIENT_ID`
- `OPENSKY_CLIENT_SECRET`
- `DATABASE_URL`

## Guardrails

The Serverless stack config sets:

- `arm64` Lambdas
- `128MB` memory
- `5s` Lambda timeout
- `4s` in-handler timeout
- `7 day` log retention
- a monthly AWS Budget with 50%, 80%, and 100% email alerts

This is designed to make the stack cheap and very likely to remain within AWS free usage for light scheduled work, but it is not a hard no-spend guarantee.

If you already manage an AWS Budget outside this stack, keep `AWS_ENABLE_BUDGET_ALERTS=false` to avoid CloudFormation budget replacement conflicts.
