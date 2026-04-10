import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.deps import engine
from app.metrics import update_app_gauges, update_celery_queue_depth
from app.routers import (
    admin,
    auth,
    dev_auth,
    dna,
    group_messages,
    group_theaters,
    groups,
    match_messages,
    matches,
    notifications,
    payments,
    profile,
    sequencing,
)
from app.security import build_allowed_origins, get_client_ip

# Configure app-level logging so services (email, matcher, etc.) output INFO
logging.basicConfig(level=logging.INFO)
logging.getLogger("app").setLevel(logging.INFO)

# Rate limiter (uses Redis in production, in-memory in dev)
limiter = Limiter(
    key_func=get_client_ip,
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

async def _metrics_poller():
    """Background task that updates Prometheus gauges every 60 seconds."""
    while True:
        await update_celery_queue_depth()
        await update_app_gauges()
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: launch metrics background poller
    task = asyncio.create_task(_metrics_poller())
    yield
    # Shutdown: cancel background task
    task.cancel()


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
    allow_origins=build_allowed_origins(settings.frontend_url),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
if settings.environment in {"development", "test"}:
    app.include_router(dev_auth.router, prefix="/auth/dev", tags=["auth-dev"])
app.include_router(sequencing.router, prefix="/sequencing", tags=["sequencing"])
app.include_router(dna.router, prefix="/dna", tags=["dna"])
app.include_router(match_messages.router, prefix="/matches", tags=["match-messages"])
app.include_router(matches.router, prefix="/matches", tags=["matches"])
app.include_router(groups.router, prefix="/groups", tags=["groups"])
app.include_router(group_messages.router, prefix="/groups", tags=["group-messages"])
app.include_router(group_theaters.router, prefix="/groups", tags=["group-theaters"])
app.include_router(profile.router, prefix="/profile", tags=["profile"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(payments.router, prefix="/payments", tags=["payments"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])

# Prometheus metrics — /metrics endpoint
instrumentator = Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=True,
    excluded_handlers=["/health", "/readiness", "/metrics"],
)
instrumentator.instrument(app).expose(app, include_in_schema=False)

# Dev mode: serve locally saved files (avatars, tickets) as static assets
if settings.environment == "development":
    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)
    if os.path.isdir(output_dir):
        app.mount("/static", StaticFiles(directory=str(output_dir)), name="static")


@app.get("/health")
async def health():
    return {"status": "ok"}


async def check_database_readiness() -> None:
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))


@app.get("/readiness")
async def readiness():
    try:
        await check_database_readiness()
    except Exception:
        logging.getLogger("app").exception("Readiness check failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not ready",
        )

    return {"status": "ready", "checks": {"database": "ok"}}


# Production: hide internal error details
if settings.environment == "production":

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logging.getLogger("app").exception("Unhandled exception")
        return JSONResponse(
            status_code=500, content={"detail": "Internal server error"}
        )
