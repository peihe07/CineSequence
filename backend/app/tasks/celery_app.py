"""Celery application configuration with Redis broker and autodiscovery."""

from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "cinesequence",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Retry policy for transient failures
    task_default_retry_delay=30,
    task_max_retries=3,
)

# Celery beat schedule for periodic tasks
celery_app.conf.beat_schedule = {
    "batch-rematch-daily": {
        "task": "app.tasks.match_tasks.batch_rematch_task",
        "schedule": crontab(hour=3, minute=0),  # Daily at 3 AM UTC
    },
    "backfill-missing-personal-tickets": {
        "task": "app.tasks.ticket_tasks.backfill_missing_personal_tickets_task",
        "schedule": crontab(minute=15, hour="*/6"),
        "args": (50,),
    },
    "invite-reminders-daily": {
        "task": "app.tasks.email_tasks.send_pending_invite_reminders_task",
        "schedule": crontab(hour=4, minute=0),  # Daily at 4 AM UTC
    },
}

# Auto-discover tasks from app.tasks package
celery_app.autodiscover_tasks(["app.tasks"])
