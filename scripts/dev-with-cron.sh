#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() {
  jobs -p | xargs -r kill >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

if [[ -f "$ROOT_DIR/.env.cron.dev" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env.cron.dev"
  set +a
elif [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

go run -C "$ROOT_DIR/cron" ./cmd/local all --watch &

cd "$ROOT_DIR"
next dev --turbopack
