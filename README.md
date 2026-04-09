# Cine Sequence

A movie-taste-based social matching platform. Users go through a 30-round binary movie selection process ("sequencing") that builds a multi-dimensional taste profile ("Movie DNA"), then get matched with people who share similar cinematic preferences.

## Architecture

- **Frontend**: Next.js 15 (App Router) + CSS Modules + Framer Motion + Zustand
- **Backend**: FastAPI (Python 3.12) + SQLAlchemy async + Celery
- **Database**: PostgreSQL 16 (pgvector) + Redis 7
- **External**: TMDB API, Gemini API (Google), Resend (email)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Deploy**: Cloudflare Workers (frontend) + Railway (backend + DB + Redis + Celery)
- **i18n**: Traditional Chinese / English (React Context-based)

## Core Flow

1. **Access** — homepage now routes new users to the dedicated registration flow, existing users sign in by magic link, and waitlist capture remains available as an operational fallback when needed
2. **Set preferences** — who to meet (gender, age) or pure taste match
3. **Seed movie** — user inputs a seed movie to establish initial signal
4. **Sequencing (30 rounds, extendable to 36)** — binary movie choices across 3 phases:
   - Phase 1 (1-7 at base=30): Quadrant Scan — rule-based pairs with guaranteed core-axis coverage plus supplementary axis sampling
   - Phase 2 (8-18 at base=30): Deep Dive — AI-powered adaptive tag exploration with curated candidate selection
   - Phase 3 (19-30 at base=30): Soul Tags / convergence — AI-powered confidence and contradiction retesting with hard duplicate prevention
   - Phase boundaries scale with `base_rounds`; legacy 20-round sessions remain 1-5 / 6-12 / 13+
   - Extension (+3 per batch, up to 2 batches): Optional extra Phase 3 rounds for finer profiling
5. **DNA Result** — archetype, tag cloud, AI personality reading (supports seasonal retest)
6. **Matching** — candidate discovery uses `0.7 * tag cosine similarity + 0.3 * quadrant similarity`, then applies reciprocal preference filtering and a configurable minimum threshold
7. **Invite** — the initiator reviews discovered candidates and sends invites individually by email
8. **Accept** — only the invited recipient can accept or decline; confirmed matches receive a ticket deep link

## Match Privacy

- Discovered matches are only visible to the initiator until an invite is sent.
- Contact details are not revealed before the recipient accepts the invite.
- Email notifications are sent at three points only: magic link login, invite received, match accepted.
- Accepted-match deep links use `/ticket?inviteId=<match_id>`.

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.12+
- Docker (for local Postgres + Redis)

### Local Development

```bash
# Start all services with Docker
docker compose up --build

# Or run individually:

# Start databases
docker compose up postgres redis -d

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

The Docker backend startup path and `npm run dev:backend` now run `alembic upgrade head`
before booting the API, so local schema drift is caught automatically.

After the backend is up, you can run a minimal smoke check:

```bash
npm run smoke:backend
```

This verifies `/health`, `/readiness`, and a basic auth endpoint response, which is enough
to catch common startup and schema-drift failures early.

### Tests

Backend tests are now split into fast unit tests and DB-backed integration tests.
Installing `backend/requirements.txt` includes the pytest dependencies needed for both.

```bash
# Fast isolated backend tests
npm run test:backend:unit

# Full backend suite
npm run test:backend

# Only integration tests (requires local Postgres test DB access)
npm run test:backend:integration

# Existing targeted backend regression/security suite
npm run test:backend:security
```

If Postgres is unavailable in the current environment, integration tests will be skipped
instead of failing during fixture setup.

### Ticket Repair

If some completed profiles are missing `personal_ticket_url`, you can backfill only the
missing tickets:

```bash
cd backend
.venv/bin/python scripts/backfill_personal_tickets.py
```

Use `--force` only when you intentionally want to regenerate every active ticket:

```bash
cd backend
.venv/bin/python scripts/backfill_personal_tickets.py --force
```

### Load Testing

Basic `k6` load scripts live in [`loadtest/`](/Users/peihe/Personal_Projects/movie-dna/loadtest).

Typical starting runs:

```bash
npm run loadtest:home
npm run loadtest:profile
npm run loadtest:sequencing
```

Override the target deployment with `BASE_URL=...` when testing staging instead of production.

### Production

```bash
cp .env.production.example .env.production
npm run docker:prod
```

For production, use the Cloudflare Workers + Railway setup documented in
`docs/production-deployment.md`. The frontend should serve `/api/*` same-origin and
proxy those requests to the Railway backend origin.

### Environment Variables

Copy `.env.example` to `.env` and fill in your API keys.

For cookie auth in production:

- Same-site or shared-parent-domain deployments can keep `AUTH_COOKIE_SAMESITE=lax`
- If Next middleware must read the auth cookie, set `AUTH_COOKIE_DOMAIN` to the shared
  parent domain, for example `.cinesequence.xyz`
- Cross-site deployments must use `AUTH_COOKIE_SAMESITE=none`
- `AUTH_COOKIE_SAMESITE=none` requires `AUTH_COOKIE_SECURE=true`

If your frontend and API are on different sites, do not rely on the default cookie policy.

For the optional footer support button, set:

- `NEXT_PUBLIC_SUPPORT_URL=https://payment.ecpay.com.tw/<your-link>`

The footer also falls back to `NEXT_PUBLIC_BUYMEACOFFEE_URL` for older deployments,
but `NEXT_PUBLIC_SUPPORT_URL` is now the preferred setting for any support platform,
including ECPay.

See `docs/production-deployment.md` for the current production deployment guide and
`docs/deployment-checklist.md` for the short verification checklist.

## Project Structure

- `frontend/` — Next.js app router frontend
- `backend/` — FastAPI application, models, routers, services, tests
- `docs/` — product, deployment, and workstream documentation
- `loadtest/` — `k6` smoke and performance scripts
- `scripts/` — validation and local utility scripts

## License

Private — All rights reserved.
