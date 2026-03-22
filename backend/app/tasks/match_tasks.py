"""Celery tasks for async matching and periodic batch re-matching."""

import asyncio
import logging
import uuid

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine from sync Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _find_matches_for_user(user_id: str):
    """Run matching algorithm for a single user."""
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    from sqlalchemy.orm import selectinload, sessionmaker

    from app.config import settings
    from app.models.user import User
    from app.services.matcher import find_matches

    engine = create_async_engine(settings.database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        result = await db.execute(
            select(User)
            .options(selectinload(User.dna_profiles))
            .where(User.id == uuid.UUID(user_id))
        )
        user = result.scalar_one_or_none()
        if not user:
            logger.warning("User %s not found for matching", user_id)
            return

        matches = await find_matches(db, user)
        logger.info("Found %d matches for user %s", len(matches), user_id)

    await engine.dispose()


async def _batch_rematch():
    """Re-run matching for all users with completed DNA profiles."""
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    from sqlalchemy.orm import selectinload, sessionmaker

    from app.config import settings
    from app.models.user import SequencingStatus, User
    from app.services.matcher import find_matches

    engine = create_async_engine(settings.database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        result = await db.execute(
            select(User)
            .options(selectinload(User.dna_profiles))
            .where(User.sequencing_status == SequencingStatus.completed)
        )
        users = result.scalars().all()

        total_matches = 0
        for user in users:
            if user.dna_profile:
                matches = await find_matches(db, user)
                total_matches += len(matches)

        logger.info("Batch rematch: %d users, %d new matches", len(users), total_matches)

    await engine.dispose()


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def find_matches_task(self, user_id: str):
    """Find matches for a user asynchronously."""
    try:
        _run_async(_find_matches_for_user(user_id))
    except Exception as exc:
        logger.exception("Match task failed for user %s", user_id)
        raise self.retry(exc=exc)


@celery_app.task
def batch_rematch_task():
    """Periodic task: re-run matching for all completed users.

    Schedule via Celery beat (e.g., daily at 3 AM).
    """
    try:
        _run_async(_batch_rematch())
    except Exception:
        logger.exception("Batch rematch task failed")
