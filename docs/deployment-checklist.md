# Deployment Checklist

## Production env

1. Copy `.env.production.example` to `.env.production`.
2. Replace all placeholder secrets and passwords.
3. Set `FRONTEND_URL`, `API_URL`, `NEXT_PUBLIC_API_URL`, and `API_PROXY_TARGET` to the real public URLs.
4. For shared-site auth, set `NEXT_PUBLIC_API_URL=/api`.
5. If Next middleware must read the auth cookie, set `AUTH_COOKIE_DOMAIN` to the shared parent domain such as `.cinesequence.xyz`.

## Cookie auth

- Same-site or shared-parent-domain frontend/API deployments can use `AUTH_COOKIE_SAMESITE=lax`.
- Cross-site deployments must use `AUTH_COOKIE_SAMESITE=none`.
- `AUTH_COOKIE_SAMESITE=none` requires `AUTH_COOKIE_SECURE=true`.

If frontend and API are on different sites, do not deploy with the default local cookie policy.

## Backend readiness

- `GET /health` is only a liveness check.
- `GET /readiness` must return `200` before the backend is considered ready to receive traffic.
- The smoke script also verifies readiness: `npm run smoke:backend`.

## Docker production

Use:

```bash
npm run docker:prod
```

That command expects `.env.production` and passes the frontend API settings into the frontend image at build time.

## Final checks

1. Confirm backend logs show migrations applied on startup.
2. Confirm `GET /readiness` returns `{"status":"ready","checks":{"database":"ok"}}`.
3. Confirm a browser login sets the `cine_sequence_session` cookie.
4. Confirm frontend requests hit `/api/*` and the proxy target is the real backend origin, not `localhost`.
