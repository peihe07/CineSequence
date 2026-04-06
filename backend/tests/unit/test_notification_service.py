import uuid
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import NotificationType
from app.services.notification_service import (
    emit_notification_safely,
    notify_dna_ready,
    notify_invite_received,
    notify_match_accepted,
    notify_match_found,
    notify_theater_activity,
    notify_theater_assigned,
)


@pytest.mark.unit
class TestEmitNotificationSafely:
    @pytest.mark.asyncio
    async def test_returns_notifier_result_when_successful(self):
        notifier = AsyncMock(return_value="ok")

        result = await emit_notification_safely(notifier, "db", 123, context="test-success")

        assert result == "ok"
        notifier.assert_awaited_once_with("db", 123)

    @pytest.mark.asyncio
    async def test_swallows_notifier_exceptions(self):
        notifier = AsyncMock(side_effect=RuntimeError("boom"))

        result = await emit_notification_safely(notifier, "db", 123, context="test-failure")

        assert result is None
        notifier.assert_awaited_once_with("db", 123)

    @pytest.mark.asyncio
    async def test_rolls_back_async_session_after_notifier_failure(self):
        db = AsyncMock(spec=AsyncSession)
        notifier = AsyncMock(side_effect=RuntimeError("boom"))

        result = await emit_notification_safely(notifier, db, 123, context="test-rollback")

        assert result is None
        notifier.assert_awaited_once_with(db, 123)
        db.rollback.assert_awaited_once()


@pytest.mark.unit
class TestNotificationCopy:
    @pytest.mark.asyncio
    async def test_notify_dna_ready_uses_intel_briefing_copy(self, monkeypatch):
        create_mock = AsyncMock()
        monkeypatch.setattr("app.services.notification_service.create_notification", create_mock)

        await notify_dna_ready(AsyncMock(spec=AsyncSession), uuid.uuid4(), "time-traveler")

        create_mock.assert_awaited_once()
        kwargs = create_mock.await_args.kwargs
        assert kwargs["type"] == NotificationType.dna_ready
        assert kwargs["title_zh"] == "DNA 解密完成"
        assert kwargs["title_en"] == "DNA DECLASSIFIED"
        assert "完整 DNA 報告" in kwargs["body_zh"]
        assert "full DNA report" in kwargs["body_en"]

    @pytest.mark.asyncio
    async def test_match_notifications_use_signal_and_contact_language(self, monkeypatch):
        create_mock = AsyncMock()
        monkeypatch.setattr("app.services.notification_service.create_notification", create_mock)
        db = AsyncMock(spec=AsyncSession)
        match_id = uuid.uuid4()

        await notify_match_found(db, uuid.uuid4(), "Alex", match_id)
        await notify_invite_received(db, uuid.uuid4(), "Rin", match_id)
        await notify_match_accepted(db, uuid.uuid4(), "Kai", match_id)

        calls = create_mock.await_args_list
        assert calls[0].kwargs["title_en"] == "SIGNAL MATCH DETECTED"
        assert "Alex" in calls[0].kwargs["body_en"]
        assert calls[1].kwargs["title_en"] == "INCOMING CLEARANCE REQUEST"
        assert "Rin" in calls[1].kwargs["body_zh"]
        assert calls[2].kwargs["title_en"] == "CONTACT ESTABLISHED"
        assert "shared ticket" in calls[2].kwargs["body_en"].lower()

    @pytest.mark.asyncio
    async def test_theater_notifications_use_dispatch_language(self, monkeypatch):
        create_mock = AsyncMock()
        monkeypatch.setattr("app.services.notification_service.create_notification", create_mock)
        db = AsyncMock(spec=AsyncSession)

        await notify_theater_assigned(
            db,
            uuid.uuid4(),
            theater_name="Mobius Loop",
            theater_id="mobius_loop",
        )
        await notify_theater_activity(
            db,
            uuid.uuid4(),
            actor_name="June",
            theater_id="mobius_loop",
            list_id="list-1",
            list_title="Time Folds",
            activity_type="list_created",
        )
        await notify_theater_activity(
            db,
            uuid.uuid4(),
            actor_name="June",
            theater_id="mobius_loop",
            list_id="list-1",
            list_title="Time Folds",
            activity_type="list_replied",
        )

        calls = create_mock.await_args_list
        assert calls[0].kwargs["title_en"] == "ASSIGNMENT ORDER ISSUED"
        assert "Mobius Loop" in calls[0].kwargs["body_en"]
        assert calls[1].kwargs["title_en"] == "THEATER DISPATCH RECEIVED"
        assert 'opened a new slate: "Time Folds"' in calls[1].kwargs["body_en"]
        assert calls[2].kwargs["title_en"] == "THEATER REPLY DETECTED"
        assert 'replied to the slate "Time Folds"' in calls[2].kwargs["body_en"]
