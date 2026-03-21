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
4. **Sequencing (20 rounds, extendable to 25)** — binary movie choices across 3 phases:
   - Phase 1 (1-5): Quadrant Scan — rule-based extreme contrast pairs
   - Phase 2 (6-12): Deep Dive — AI-powered nuance testing
   - Phase 3 (13-20): Soul Tags — AI-powered value/personality probing
   - Extension (+5): Optional extra rounds for finer profiling
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
alembic upgrade head
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

### Production

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your API keys.

## Project Structure

See `docs/project-structure.md` for detailed directory layout.

## License

Private — All rights reserved.
