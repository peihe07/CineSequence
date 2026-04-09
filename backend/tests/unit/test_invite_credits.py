"""Unit tests for invite credit logic."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.services.matcher import _consume_invite_credit, get_invite_credit_count
from app.models.user import Gender, User


def _make_user(**overrides) -> User:
    defaults = dict(
        id=uuid.uuid4(),
        email="test@example.com",
        name="Test",
        gender=Gender.other,
        region="TW",
        free_retest_credits=0,
        paid_sequencing_credits=0,
        invite_unlocked=False,
        beta_entitlement_override=False,
    )
    defaults.update(overrides)
    return User(**defaults)


def _mock_today_invites(count: int):
    return patch("app.services.matcher._get_today_invite_count", AsyncMock(return_value=count))


@pytest.mark.asyncio
async def test_consume_invite_skipped_when_unlocked():
    user = _make_user(invite_unlocked=True)
    db = AsyncMock()
    await _consume_invite_credit(db, user)
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_consume_invite_succeeds_with_available_credit():
    user = _make_user()
    db = AsyncMock()

    with _mock_today_invites(3):
        await _consume_invite_credit(db, user)


@pytest.mark.asyncio
async def test_consume_invite_raises_when_no_credits():
    user = _make_user()
    db = AsyncMock()

    with _mock_today_invites(5):
        with pytest.raises(PermissionError, match="Daily invite limit reached"):
            await _consume_invite_credit(db, user)


@pytest.mark.asyncio
async def test_get_invite_credit_count_unlocked():
    user = _make_user(invite_unlocked=True)
    db = AsyncMock()

    result = await get_invite_credit_count(db, user)
    assert result == {"remaining": -1, "unlocked": True}


@pytest.mark.asyncio
async def test_get_invite_credit_count_normal():
    user = _make_user()
    db = AsyncMock()

    with _mock_today_invites(3):
        result = await get_invite_credit_count(db, user)
    assert result == {"remaining": 2, "unlocked": False, "daily_limit": 5}
