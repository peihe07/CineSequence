# Cine Sequence

A movie-taste-based social matching platform. Users go through a 20-round binary movie selection process ("sequencing") that builds a multi-dimensional taste profile ("Movie DNA"), then get matched with people who share similar cinematic preferences.

## Architecture

- **Frontend**: Next.js 15 (App Router) + CSS Modules + Framer Motion + Zustand
- **Backend**: FastAPI (Python 3.12) + SQLAlchemy async + Celery
- **Database**: PostgreSQL 16 (pgvector) + Redis 7
- **External**: TMDB API, Gemini API (Google), Resend (email)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Deploy**: Vercel (frontend) + Railway (backend + DB + Redis)
- **i18n**: Traditional Chinese / English (React Context-based)

## Core Flow

1. **Register** — email (magic link), name, avatar, gender, region
2. **Set preferences** — who to meet (gender, age) or pure taste match
3. **Seed movie** — user inputs a seed movie to establish initial signal
4. **Sequencing (20 rounds, extendable to 35)** — binary movie choices across 3 phases:
   - Phase 1 (1-5): Quadrant Scan — randomized from 40-pair pool with guaranteed quadrant axis coverage
   - Phase 2 (6-12): Deep Dive — AI-powered nuance testing with 266-movie curated candidate pool
   - Phase 3 (13-20): Soul Tags — AI-powered value/personality probing with hard duplicate prevention
   - Extension (+5 per batch, up to 3 batches): Optional extra rounds for finer profiling
5. **DNA Result** — archetype, tag cloud, AI personality reading (supports seasonal retest)
6. **Matching** — 80%+ cosine similarity matches, group recommendations
7. **Invite** — email invitation with match details, mutual accept to connect

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

### Production

```bash
cp .env.production.example .env.production
npm run docker:prod
```

For production Docker deploys, the frontend build now reads `NEXT_PUBLIC_API_URL` from
`.env.production` at image build time. Do not rely on runtime-only env injection for
Next.js public variables.

### Environment Variables

Copy `.env.example` to `.env` and fill in your API keys.

For cookie auth in production:

- Same-site deployments can keep `AUTH_COOKIE_SAMESITE=lax`
- Cross-site deployments must use `AUTH_COOKIE_SAMESITE=none`
- `AUTH_COOKIE_SAMESITE=none` requires `AUTH_COOKIE_SECURE=true`

If your frontend and API are on different sites, do not rely on the default cookie policy.

See `docs/deployment-checklist.md` for the full production checklist.

## Project Structure

See `docs/project-structure.md` for detailed directory layout.

## License

Private — All rights reserved.
