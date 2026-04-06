#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PATTERN='var\(--accent,\s*#e57e31\)|var\(--accent-hover,\s*#cf6e2a\)|var\(--color-accent-noir,\s*#e57e31\)|#b33a3a|#2d8659'

if rg -n --glob '*.module.css' --glob '!frontend/app/globals.css' "$PATTERN" frontend; then
  echo "Design token lint failed: replace legacy accent/success/error fallbacks with semantic tokens."
  exit 1
fi
