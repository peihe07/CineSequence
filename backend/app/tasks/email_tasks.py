"""Celery tasks for sending emails asynchronously."""

import logging

from app.tasks.async_utils import run_async
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_invite_email_task(self, **kwargs):
    """Send match invite email asynchronously."""
    from app.services.email_service import send_invite_email

    try:
        run_async(send_invite_email(**kwargs))
        logger.info("Sent invite email for match %s", kwargs.get("match_id"))
    except Exception as exc:
        logger.exception("Failed to send invite email, retrying...")
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_accepted_email_task(self, **kwargs):
    """Send match accepted email asynchronously."""
    from app.services.email_service import send_match_accepted_email

    try:
        run_async(send_match_accepted_email(**kwargs))
        logger.info("Sent accepted email to %s", kwargs.get("to_email"))
    except Exception as exc:
        logger.exception("Failed to send accepted email, retrying...")
        raise self.retry(exc=exc)
