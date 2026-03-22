"""Celery tasks for sending emails asynchronously."""

import asyncio
import logging

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine from sync Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_invite_email_task(self, **kwargs):
    """Send match invite email asynchronously."""
    from app.services.email_service import send_invite_email

    try:
        _run_async(send_invite_email(**kwargs))
        logger.info("Sent invite email for match %s", kwargs.get("match_id"))
    except Exception as exc:
        logger.exception("Failed to send invite email, retrying...")
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_accepted_email_task(self, **kwargs):
    """Send match accepted email asynchronously."""
    from app.services.email_service import send_match_accepted_email

    try:
        _run_async(send_match_accepted_email(**kwargs))
        logger.info("Sent accepted email to %s", kwargs.get("to_email"))
    except Exception as exc:
        logger.exception("Failed to send accepted email, retrying...")
        raise self.retry(exc=exc)
