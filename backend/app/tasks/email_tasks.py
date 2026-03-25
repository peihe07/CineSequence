"""Celery tasks for sending emails asynchronously."""

import logging
from datetime import UTC, datetime

from app.tasks.async_utils import run_async
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _send_pending_invite_reminders(db, *, now: datetime | None = None):
    from app.services.email_service import send_invite_email
    from app.services.matcher import (
        _get_archetype_name,
        get_pending_invite_reminders,
        mark_invite_reminder_sent,
    )

    current_time = now or datetime.now(UTC)
    due_matches = await get_pending_invite_reminders(db, now=current_time)
    for match in due_matches:
        await send_invite_email(
            recipient_email=match.user_b.email,
            recipient_name=match.user_b.name,
            inviter_name=match.user_a.name,
            inviter_archetype=_get_archetype_name(match.user_a),
            shared_tags=match.shared_tags or [],
            ice_breakers=match.ice_breakers or [],
            match_id=match.id,
            reminder_number=match.invite_reminder_count + 1,
        )
        await mark_invite_reminder_sent(db, match, sent_at=current_time)


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


@celery_app.task
def send_pending_invite_reminders_task():
    """Periodic task: send invite reminders for pending invites after 3 and 7 days."""
    from app.tasks.async_utils import task_session

    async def _run():
        async with task_session() as db:
            await _send_pending_invite_reminders(db)

    try:
        run_async(_run())
    except Exception:
        logger.exception("Failed to send pending invite reminders")
