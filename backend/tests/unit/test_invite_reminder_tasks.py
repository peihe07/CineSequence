from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


@pytest.mark.asyncio
async def test_send_pending_invite_reminders_sends_and_marks_due_matches():
    from app.tasks.email_tasks import _send_pending_invite_reminders

    match = SimpleNamespace(
        id=uuid4(),
        shared_tags=["noir"],
        ice_breakers=["Talk about endings"],
        invite_reminder_count=0,
        user_a=SimpleNamespace(name="Alice", dna_profile=None),
        user_b=SimpleNamespace(email="bob@example.com", name="Bob"),
    )

    mock_db = MagicMock()
    pending_reminders = AsyncMock(return_value=[match])

    with (
        patch(
            "app.services.matcher.get_pending_invite_reminders",
            new=pending_reminders,
        ),
        patch("app.services.matcher.mark_invite_reminder_sent", new=AsyncMock()),
        patch(
            "app.services.email_service.send_invite_email",
            new=AsyncMock(),
        ) as send_invite_email,
        patch("app.services.matcher.get_archetype_name", return_value="電影愛好者"),
    ):
        await _send_pending_invite_reminders(mock_db, now=datetime.now(UTC) - timedelta(days=3))

    send_invite_email.assert_awaited_once()
    assert send_invite_email.await_args.kwargs["reminder_number"] == 1
