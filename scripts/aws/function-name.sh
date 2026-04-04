#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: function-name.sh <job>" >&2
  exit 1
fi

JOB="$1"
STAGE="${SLS_STAGE:-${STAGE:-dev}}"

echo "flightnotifier-crons-${STAGE}-${JOB}"
