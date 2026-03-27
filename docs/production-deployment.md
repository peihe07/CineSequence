# Production Deployment

This is the current working production setup for Cine Sequence.

## Final Architecture

- Frontend: Cloudflare Workers
- Frontend domain: `https://cinesequence.xyz`
- Backend: Railway
- Backend origin currently in use: `https://cinesequence-production.up.railway.app`
- Database: Railway PostgreSQL
- Queue/cache: Railway Redis
- Background jobs: Railway `celery-worker` + `celery-beat`

Important:

- The site currently works through same-origin frontend requests to `/api/*`.
- Cloudflare Workers proxies `/api/*` to the Railway backend origin.
- `https://api.cinesequence.xyz` is not required for the current production flow.

## Frontend Deployment

Cloudflare Workers project settings:

- Root directory: `frontend`
- Build command: `npm run build:worker`
- Deploy command: `npm run deploy:worker`

Frontend environment variables:

```env
NEXT_PUBLIC_API_URL=/api
API_PROXY_TARGET=https://cinesequence-production.up.railway.app
AUTH_COOKIE_NAME=cine_sequence_session
ENVIRONMENT=production
```

Notes:

- Do not set `NEXT_PUBLIC_API_URL` to the Railway backend URL.
- Keep `NEXT_PUBLIC_API_URL=/api` so browser traffic stays same-origin.
- The Workers runtime handles the proxy using the Next.js rewrite configuration.

## Backend Deployment

Railway backend environment variables:

```env
FRONTEND_URL=https://cinesequence.xyz
API_URL=https://cinesequence-production.up.railway.app
AUTH_COOKIE_DOMAIN=.cinesequence.xyz
AUTH_COOKIE_SAMESITE=lax
AUTH_COOKIE_SECURE=true
ENVIRONMENT=production

DATABASE_URL=...
REDIS_URL=redis://.../0
CELERY_BROKER_URL=redis://.../1
CELERY_RESULT_BACKEND=redis://.../2

JWT_SECRET=...
MAGIC_LINK_SECRET=...
TMDB_API_KEY=...
GEMINI_API_KEY=...
RESEND_API_KEY=...
S3_BUCKET=...
S3_ENDPOINT=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_PUBLIC_URL=...
ADMIN_EMAILS=...
```

Notes:

- `AUTH_COOKIE_DOMAIN=.cinesequence.xyz` is required so login state persists on the production site.
- The backend health endpoints must work on the Railway public domain before frontend deployment is attempted.
- The backend root path `/` returning `{"detail":"Not Found"}` is normal. Use `/health` and `/readiness`.

## Redis Layout

Use the Railway private Redis URL, split by database index:

```env
REDIS_URL=redis://...@redis.railway.internal:6379/0
CELERY_BROKER_URL=redis://...@redis.railway.internal:6379/1
CELERY_RESULT_BACKEND=redis://...@redis.railway.internal:6379/2
```

Use private/internal Redis URLs for app-to-service traffic. Do not use the public Redis endpoint for normal production services.

## Celery Services

### celery-worker

Start command:

```bash
celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4
```

### celery-beat

Start command:

```bash
celery -A app.tasks.celery_app beat --loglevel=info
```

Beat also runs a personal-ticket repair scan every 3 hours in batches of 50 profiles.
This only processes active completed DNA profiles where `personal_ticket_url` is missing.

Both services should use the same production variables as the backend, especially:

- `DATABASE_URL`
- `REDIS_URL`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`
- all secrets and external API keys

Neither Celery service needs public networking or a domain.

## Ticket Backfill

For one-time repair of older profiles that missed ticket generation:

```bash
cd backend
.venv/bin/python scripts/backfill_personal_tickets.py
```

Use `--force` only if you want to regenerate every active ticket:

```bash
cd backend
.venv/bin/python scripts/backfill_personal_tickets.py --force
```

## Validation Flow

After deployment, verify in this order:

1. `https://cinesequence-production.up.railway.app/health`
2. `https://cinesequence-production.up.railway.app/readiness`
3. `https://cinesequence.xyz/`
4. `https://cinesequence.xyz/api/health`
5. `https://cinesequence.xyz/profile`
6. Register with magic link
7. Verify the link and confirm session persists on `https://cinesequence.xyz/profile`

Expected behavior:

- `/health` returns `{"status":"ok"}`
- `/readiness` returns `{"status":"ready","checks":{"database":"ok"}}`
- `/profile` redirects to `/login?next=%2Fprofile` when logged out
- after login, `/profile` stays authenticated

## Known Non-Blocking Issue

`https://api.cinesequence.xyz` may still fail independently.

That is currently non-blocking because production traffic does not rely on it. The live site uses:

- browser -> `https://cinesequence.xyz/api/*`
- Workers proxy -> `https://cinesequence-production.up.railway.app/*`

Do not block production rollout on `api.cinesequence.xyz` unless you specifically need a separate public API hostname.

## Operational Notes

- Keep the `workers.dev` domain enabled for testing if useful, but do not use it to validate production cookie behavior.
- Production login validation must happen on `https://cinesequence.xyz`.
- Rotate any credentials that were ever pasted into chat, screenshots, logs, or shared documents.
