from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.deps import get_db
from app.main import app
from app.models import Base
from app.routers.auth import limiter as auth_limiter

base_database_url = make_url(settings.database_url)
test_database_name = f"{base_database_url.database}_test"
TEST_DATABASE_URL = base_database_url.set(database=test_database_name).render_as_string(
    hide_password=False
)
ADMIN_DATABASE_URL = base_database_url.set(database="postgres").render_as_string(
    hide_password=False
)

engine = create_async_engine(TEST_DATABASE_URL, echo=True, poolclass=NullPool)
admin_engine = create_async_engine(
    ADMIN_DATABASE_URL,
    isolation_level="AUTOCOMMIT",
    poolclass=NullPool,
)
test_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def reset_test_schema() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))


@pytest_asyncio.fixture(scope="session", autouse=True)
async def ensure_test_database():
    """Create the integration-test database on demand."""
    async with admin_engine.connect() as conn:
        exists = await conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :name"),
            {"name": test_database_name},
        )
        if not exists:
            await conn.execute(text(f'CREATE DATABASE "{test_database_name}"'))

    yield

    await admin_engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def setup_database(ensure_test_database):
    """Create tables before each test, drop after."""
    app.state.limiter._storage.reset()
    auth_limiter._storage.reset()
    await reset_test_schema()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    app.state.limiter._storage.reset()
    auth_limiter._storage.reset()
    await reset_test_schema()


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession]:
    async with test_session() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient]:
    """HTTP client with overridden DB dependency."""

    async def override_get_db() -> AsyncGenerator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
