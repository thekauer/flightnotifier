#!/usr/bin/env bash

set -euo pipefail

STAGE="${SLS_STAGE:-${STAGE:-dev}}"

aws lambda list-functions \
  --query "Functions[?starts_with(FunctionName, 'flightnotifier-crons-${STAGE}-')].FunctionName" \
  --output table
