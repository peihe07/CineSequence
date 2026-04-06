"""Unit tests for invite credit logic."""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.user import Gender, User
from app.models.user_entitlement import EntitlementStatus, EntitlementType, UserEntitlement
from app.services.matcher import _consume_invite_credit, get_invite_credit_count


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


def _mock_db_with_entitlement(ent):
    """Mock db.execute to return a single entitlement (or None)."""
    db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = ent
    db.execute = AsyncMock(return_value=mock_result)
    return db


def _mock_db_with_count(count: int):
    db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar.return_value = count
    db.execute = AsyncMock(return_value=mock_result)
    return db


@pytest.mark.asyncio
async def test_consume_invite_skipped_when_unlocked():
    user = _make_user(invite_unlocked=True)
    db = AsyncMock()
    await _consume_invite_credit(db, user)
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_consume_invite_succeeds_with_available_credit():
    user = _make_user()
    ent = UserEntitlement(
        user_id=user.id,
        type=EntitlementType.invite,
        status=EntitlementStatus.available,
    )
    db = _mock_db_with_entitlement(ent)

    await _consume_invite_credit(db, user)

    assert ent.status == EntitlementStatus.consumed
    assert ent.consumed_at is not None


@pytest.mark.asyncio
async def test_consume_invite_raises_when_no_credits():
    user = _make_user()
    db = _mock_db_with_entitlement(None)

    with pytest.raises(PermissionError, match="No invite credits"):
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
    db = _mock_db_with_count(3)

    result = await get_invite_credit_count(db, user)
    assert result == {"remaining": 3, "unlocked": False}
