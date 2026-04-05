#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAGE="${SLS_STAGE:-${STAGE:-prod}}"
REGION="${AWS_REGION:-eu-central-1}"
FUNCTIONS=(batch adsblol)

disable_rules_for_function() {
  local function_name="$1"
  local function_arn
  local rules

  function_arn="$(aws lambda get-function \
    --function-name "$function_name" \
    --query 'Configuration.FunctionArn' \
    --output text \
    --region "$REGION")"

  rules="$(aws events list-rule-names-by-target \
    --target-arn "$function_arn" \
    --query 'RuleNames[]' \
    --output text \
    --region "$REGION")"

  if [[ -z "$rules" || "$rules" == "None" ]]; then
    echo "No schedule rules found for $function_name"
    return
  fi

  for rule in $rules; do
    echo "Disabling rule $rule"
    aws events disable-rule \
      --name "$rule" \
      --region "$REGION" >/dev/null
  done
}

for job in "${FUNCTIONS[@]}"; do
  disable_rules_for_function "flightnotifier-crons-${STAGE}-${job}"
done

echo "Disabled cron schedule rules for stage $STAGE in region $REGION"
