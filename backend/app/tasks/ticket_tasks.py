"""Celery tasks for repairing missing personal ticket images."""

import logging
from inspect import CORO_CREATED, getcoroutinestate

from app.tasks.async_utils import run_async, task_session
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _backfill_missing_personal_tickets(limit: int = 50):
    from app.services.personal_ticket_backfill import backfill_personal_tickets

    async with task_session() as db:
        result = await backfill_personal_tickets(db, force=False, limit=limit)
        logger.info(
            "Personal ticket backfill scan completed: processed=%d success=%d failed=%d",
            result.processed,
            result.success,
            result.failed,
        )


@celery_app.task
def backfill_missing_personal_tickets_task(limit: int = 50):
    """Periodic task: repair missing personal tickets in small batches."""
    coro = _backfill_missing_personal_tickets(limit)
    try:
        run_async(coro)
    except Exception:
        logger.exception("Personal ticket backfill task failed")
    finally:
        if getcoroutinestate(coro) == CORO_CREATED:
            coro.close()
