#!/bin/sh
set -eu

API_URL="${API_URL:-http://127.0.0.1:8000}"

health_code="$(curl -sS -o /tmp/cine-health.json -w '%{http_code}' "$API_URL/health")"
if [ "$health_code" != "200" ]; then
  echo "Health check failed with status $health_code"
  cat /tmp/cine-health.json
  exit 1
fi

health_body="$(cat /tmp/cine-health.json)"
if [ "$health_body" != '{"status":"ok"}' ]; then
  echo "Unexpected health response: $health_body"
  exit 1
fi

auth_code="$(curl -sS -o /tmp/cine-auth.json -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke-test@example.com"}' \
  "$API_URL/auth/login")"
if [ "$auth_code" != "200" ]; then
  echo "Auth smoke check failed with status $auth_code"
  cat /tmp/cine-auth.json
  exit 1
fi

auth_body="$(cat /tmp/cine-auth.json)"
case "$auth_body" in
  *"If this email is registered, a magic link has been sent."*)
    ;;
  *)
    echo "Unexpected auth response: $auth_body"
    exit 1
    ;;
esac

echo "Backend smoke checks passed."
