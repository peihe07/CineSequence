from unittest.mock import AsyncMock

import pytest

from app.services.notification_service import emit_notification_safely


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
