"""Custom Prometheus metrics for Celery queue depth and app-level gauges."""

import logging

from prometheus_client import Gauge

logger = logging.getLogger(__name__)

# Celery queue depth (polled periodically via /metrics or a background task)
celery_queue_depth = Gauge(
    "celery_queue_depth",
    "Number of tasks waiting in the Celery broker queue",
    ["queue"],
)

# Active users (users with completed sequencing)
active_users_total = Gauge(
    "app_active_users_total",
    "Number of users who have completed sequencing",
)

# DNA profiles
dna_profiles_total = Gauge(
    "app_dna_profiles_total",
    "Number of active DNA profiles",
)

# Matches
matches_total = Gauge(
    "app_matches_total",
    "Total number of matches",
    ["status"],
)


async def update_celery_queue_depth() -> None:
    """Read Celery queue length from Redis and update the gauge."""
    try:
        from app.deps import redis_client

        length = await redis_client.llen("celery")
        celery_queue_depth.labels(queue="celery").set(length)
    except Exception:
        logger.debug("Failed to read Celery queue depth from Redis")


async def update_app_gauges() -> None:
    """Update app-level gauges from the database."""
    try:
        from sqlalchemy import func, select

        from app.deps import async_session
        from app.models.dna_profile import DnaProfile
        from app.models.match import Match
        from app.models.user import SequencingStatus, User

        async with async_session() as db:
            # Active users
            count = await db.scalar(
                select(func.count(User.id)).where(
                    User.sequencing_status == SequencingStatus.completed
                )
            )
            active_users_total.set(count or 0)

            # DNA profiles
            dna_count = await db.scalar(
                select(func.count(DnaProfile.id)).where(DnaProfile.is_active.is_(True))
            )
            dna_profiles_total.set(dna_count or 0)

            # Matches by status
            match_result = await db.execute(
                select(Match.status, func.count(Match.id)).group_by(Match.status)
            )
            for status, cnt in match_result.all():
                matches_total.labels(status=status.value).set(cnt)
    except Exception:
        logger.debug("Failed to update app gauges")
