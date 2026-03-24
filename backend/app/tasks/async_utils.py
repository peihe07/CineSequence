"""Shared async utilities for Celery tasks."""

import asyncio

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

# Single shared engine for all Celery tasks — avoids creating a new engine per task.
_engine = create_async_engine(
    settings.database_url,
    pool_size=5,
    max_overflow=5,
    pool_recycle=1800,
    pool_pre_ping=True,
)

task_session = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)


def run_async(coro):
    """Run an async coroutine from a sync Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()
