#!/usr/bin/env bash

set -euo pipefail
set -m

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cron_pid=""
web_pid=""

terminate_process_group() {
  local pid="$1"

  if [[ -z "$pid" ]]; then
    return
  fi

  kill -TERM -- "-$pid" >/dev/null 2>&1 || kill -TERM "$pid" >/dev/null 2>&1 || true
}

force_terminate_process_group() {
  local pid="$1"

  if [[ -z "$pid" ]]; then
    return
  fi

  kill -KILL -- "-$pid" >/dev/null 2>&1 || kill -KILL "$pid" >/dev/null 2>&1 || true
}

cleanup() {
  trap - EXIT INT TERM

  local pids=()

  if [[ -n "$web_pid" ]]; then
    pids+=("$web_pid")
  fi

  if [[ -n "$cron_pid" ]]; then
    pids+=("$cron_pid")
  fi

  for pid in "${pids[@]}"; do
    terminate_process_group "$pid"
  done

  sleep 1

  for pid in "${pids[@]}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      force_terminate_process_group "$pid"
    fi
  done

  wait "${pids[@]}" 2>/dev/null || true
}

handle_signal() {
  cleanup
  exit 130
}

trap cleanup EXIT
trap handle_signal INT TERM

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
cron_pid=$!

cd "$ROOT_DIR"
NODE_ENV=development node server.mjs &
web_pid=$!

set +e
wait -n "$cron_pid" "$web_pid"
status=$?
set -e

cleanup
exit "$status"
