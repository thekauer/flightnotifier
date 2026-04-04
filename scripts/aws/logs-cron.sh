#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: logs-cron.sh <job> [--since 10m]" >&2
  exit 1
fi

JOB="$1"
shift || true
FUNCTION_NAME="$(bash "$(dirname "$0")/function-name.sh" "$JOB")"

aws logs tail "/aws/lambda/${FUNCTION_NAME}" --follow "$@"
