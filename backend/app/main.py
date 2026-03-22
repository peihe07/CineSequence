import logging
from contextlib import asynccontextmanager
from urllib.parse import urlsplit, urlunsplit

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings

# Configure app-level logging so services (email, matcher, etc.) output INFO
logging.basicConfig(level=logging.INFO)
logging.getLogger("app").setLevel(logging.INFO)
from app.routers import auth, dna, groups, matches, profile, sequencing

# Rate limiter (uses Redis in production, in-memory in dev)
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["60/minute"],
    storage_uri=settings.redis_url if settings.environment == "production" else None,
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if settings.environment == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response


def _build_allowed_origins(frontend_url: str) -> list[str]:
    """Accept both localhost and 127.0.0.1 for local dev credentials flows."""
    origins = {frontend_url}
    parsed = urlsplit(frontend_url)

    if parsed.hostname == "localhost":
        origins.add(
            urlunsplit((parsed.scheme, f"127.0.0.1:{parsed.port}", parsed.path, "", ""))
        )
    elif parsed.hostname == "127.0.0.1":
        origins.add(
            urlunsplit((parsed.scheme, f"localhost:{parsed.port}", parsed.path, "", ""))
        )

    return sorted(origins)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: init DB pool, Redis connection
    yield
    # Shutdown: cleanup


app = FastAPI(
    title="Cine Sequence API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url=None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_build_allowed_origins(settings.frontend_url),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
if settings.environment != "production":
    from app.routers import dev_auth

    app.include_router(dev_auth.router, prefix="/auth/dev", tags=["auth-dev"])
app.include_router(sequencing.router, prefix="/sequencing", tags=["sequencing"])
app.include_router(dna.router, prefix="/dna", tags=["dna"])
app.include_router(matches.router, prefix="/matches", tags=["matches"])
app.include_router(groups.router, prefix="/groups", tags=["groups"])
app.include_router(profile.router, prefix="/profile", tags=["profile"])

# Dev mode: serve locally saved files (avatars, tickets) as static assets
if settings.environment == "development":
    import os
    from pathlib import Path

    from fastapi.staticfiles import StaticFiles

    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)
    if os.path.isdir(output_dir):
        app.mount("/static", StaticFiles(directory=str(output_dir)), name="static")


@app.get("/health")
async def health():
    return {"status": "ok"}


# Production: hide internal error details
if settings.environment == "production":

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logging.getLogger("app").exception("Unhandled exception")
        return JSONResponse(
            status_code=500, content={"detail": "Internal server error"}
        )
