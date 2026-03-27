# Load Testing

This guide covers the `k6` scripts under `loadtest/` for staged load checks against the live or staging deployment.

## Prerequisite

Install `k6` locally:

```bash
brew install k6
```

## Scenarios

- `loadtest/home.js`
  Checks homepage delivery and basic HTML integrity.
- `loadtest/api-profile.js`
  Checks the cookie-backed profile endpoint. For anonymous traffic, `401`/`403` is expected.
- `loadtest/sequencing-progress.js`
  Checks the protected sequencing route boundary. Depending on deployment shape, `200`, redirect, or auth-boundary response is acceptable.

## Quick Start

Run the default ramp (`10 -> 30 -> 50 -> 0` VUs):

```bash
k6 run loadtest/home.js
k6 run loadtest/api-profile.js
k6 run loadtest/sequencing-progress.js
```

Run against staging:

```bash
BASE_URL=https://staging.cinesequence.xyz k6 run loadtest/home.js
```

Customize the ramp:

```bash
BASE_URL=https://cinesequence.xyz \
RAMP_1_TARGET=10 \
RAMP_2_TARGET=30 \
RAMP_3_TARGET=100 \
RAMP_1_DURATION=30s \
RAMP_2_DURATION=45s \
RAMP_3_DURATION=60s \
RAMP_DOWN_DURATION=30s \
k6 run loadtest/api-profile.js
```

## What To Watch

Track these while the scripts run:

- `http_req_duration` p95 and p99
- `http_req_failed`
- Railway CPU / memory
- Postgres connection count / CPU
- Redis latency
- Celery queue depth

Stop and investigate if p95 spikes sharply, 5xx responses appear, or worker / DB utilization plateaus at the limit.
