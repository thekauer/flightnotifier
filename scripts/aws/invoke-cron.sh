#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: invoke-cron.sh <job>" >&2
  exit 1
fi

JOB="$1"
FUNCTION_NAME="$(bash "$(dirname "$0")/function-name.sh" "$JOB")"
TMP_OUTPUT="$(mktemp)"

aws lambda invoke \
  --function-name "$FUNCTION_NAME" \
  --payload "{\"job\":\"$JOB\"}" \
  --cli-binary-format raw-in-base64-out \
  "$TMP_OUTPUT" >/dev/null

cat "$TMP_OUTPUT"
rm -f "$TMP_OUTPUT"
