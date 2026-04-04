#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD_DIR="$ROOT_DIR/.aws-cron-build"
GO_MODULE_DIR="$ROOT_DIR/cron"
FUNCTIONS=(opensky metar flighty adsbdb tracks adsblol)

mkdir -p "$BUILD_DIR"

for fn in "${FUNCTIONS[@]}"; do
  WORK_DIR="$BUILD_DIR/$fn"
  rm -rf "$WORK_DIR" "$BUILD_DIR/$fn.zip"
  mkdir -p "$WORK_DIR"

  GOOS=linux GOARCH=arm64 CGO_ENABLED=0 \
    go build \
    -C "$GO_MODULE_DIR" \
    -trimpath \
    -ldflags="-s -w" \
    -o "$WORK_DIR/bootstrap" \
    "./cmd/$fn"

  (
    cd "$WORK_DIR"
    zip -q "$BUILD_DIR/$fn.zip" bootstrap
  )
done
