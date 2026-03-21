import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

# Configure app-level logging so services (email, matcher, etc.) output INFO
logging.basicConfig(level=logging.INFO)
logging.getLogger("app").setLevel(logging.INFO)
from app.routers import auth, dna, groups, matches, profile, sequencing


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: init DB pool, Redis connection
    yield
    # Shutdown: cleanup


app = FastAPI(
    title="Cine Sequence API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(sequencing.router, prefix="/sequencing", tags=["sequencing"])
app.include_router(dna.router, prefix="/dna", tags=["dna"])
app.include_router(matches.router, prefix="/matches", tags=["matches"])
app.include_router(groups.router, prefix="/groups", tags=["groups"])
app.include_router(profile.router, prefix="/profile", tags=["profile"])


@app.get("/health")
async def health():
    return {"status": "ok"}
