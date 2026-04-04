# Vercel Firewall Rate Limits

Use Vercel Firewall for public API rate limiting instead of app-memory counters. This app runs on serverless infrastructure, so in-process memory does not provide a reliable global per-IP limit.

## Recommended starting rules

Create these rules in Vercel Dashboard -> Project -> Firewall.

### 1. SSE endpoints

- Name: `Public API SSE`
- Condition: Request Path equals `/api/events`
- Action: `Rate Limit`
- Threshold: `10 requests per 1 minute`
- Follow-up action: `429 response`

Create the same rule for `/api/legacy/events`.

These endpoints keep a long-lived connection open, so the request count should stay low during normal use. `10/minute/IP` leaves room for reconnects while still being conservative.

### 2. All other public API endpoints

- Name: `Public API`
- Condition: Request Path starts with `/api/`
- Exclude: `/api/events`
- Exclude: `/api/legacy/events`
- Action: `Rate Limit`
- Threshold: `30 requests per 1 minute`
- Follow-up action: `429 response`

This is intentionally conservative for the current frontend usage pattern, which mostly bootstraps state once and then stays on SSE.

## Rollout

1. Create the rules in `Log` mode first if you want to observe traffic before enforcement.
2. Switch the action to `429 response` once the limits look safe.
3. If clients hit the limit during normal browsing, raise the broad rule before the SSE rule.

## Why not in code

An in-memory limiter inside a serverless function only sees requests handled by that specific warm instance. With multiple instances or regions, requests from one IP can be split across separate counters, which makes the limit inconsistent.
