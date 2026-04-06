"""Unit tests for sequencing entitlement gating and consumption."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.models.user import Gender, User
from app.models.user_entitlement import EntitlementType
from app.services.sequencing_entitlements import (
    can_start_extension,
    can_start_retest,
    consume_extension_credit,
    consume_retest_credit,
)


def _make_user(**overrides) -> User:
    defaults = dict(
        id=uuid.uuid4(),
        email="test@example.com",
        name="Test",
        gender=Gender.other,
        region="TW",
        free_retest_credits=0,
        paid_sequencing_credits=0,
        beta_entitlement_override=False,
    )
    defaults.update(overrides)
    return User(**defaults)


def _mock_count(value: int):
    """Patch _count_available to return a fixed value."""
    return patch(
        "app.services.sequencing_entitlements._count_available",
        AsyncMock(return_value=value),
    )


def _mock_consume_one():
    """Patch _consume_one as a no-op."""
    return patch(
        "app.services.sequencing_entitlements._consume_one",
        AsyncMock(),
    )


@pytest.mark.asyncio
async def test_can_start_retest_with_free_credit():
    db = AsyncMock()
    user = _make_user(free_retest_credits=1)

    with _mock_count(0):
        gate = await can_start_retest(db, user)

    assert gate.allowed is True
    assert gate.reason == "free_retest_available"


@pytest.mark.asyncio
async def test_can_start_retest_with_paid_entitlement():
    db = AsyncMock()
    user = _make_user()

    with _mock_count(2):
        gate = await can_start_retest(db, user)

    assert gate.allowed is True
    assert gate.reason == "paid_credit_available"


@pytest.mark.asyncio
async def test_can_start_retest_no_credits():
    db = AsyncMock()
    user = _make_user()

    with _mock_count(0):
        gate = await can_start_retest(db, user)

    assert gate.allowed is False
    assert gate.reason == "payment_required"


@pytest.mark.asyncio
async def test_can_start_extension_requires_paid_entitlement():
    db = AsyncMock()
    user = _make_user()

    with _mock_count(0):
        gate = await can_start_extension(db, user)

    assert gate.allowed is False
    assert gate.reason == "payment_required"


@pytest.mark.asyncio
async def test_can_start_extension_with_paid_entitlement():
    db = AsyncMock()
    user = _make_user()

    with _mock_count(1):
        gate = await can_start_extension(db, user)

    assert gate.allowed is True
    assert gate.reason == "paid_credit_available"


@pytest.mark.asyncio
async def test_consume_extension_credit():
    db = AsyncMock()
    user = _make_user()

    with _mock_consume_one() as mock_consume, _mock_count(2):
        result = await consume_extension_credit(db, user)

    mock_consume.assert_awaited_once_with(db, user.id, EntitlementType.extension)
    assert result.kind_used == "paid_credit"
    assert result.credits_remaining == 2


@pytest.mark.asyncio
async def test_consume_retest_uses_free_credit_first():
    db = AsyncMock()
    user = _make_user(free_retest_credits=1)

    with _mock_count(3):
        result = await consume_retest_credit(db, user)

    assert result.kind_used == "free_retest"
    assert result.free_retests_remaining == 0
    assert user.free_retest_credits == 0
    db.flush.assert_awaited_once()


@pytest.mark.asyncio
async def test_consume_retest_uses_paid_when_no_free():
    db = AsyncMock()
    user = _make_user()

    with _mock_consume_one() as mock_consume, _mock_count(1):
        result = await consume_retest_credit(db, user)

    mock_consume.assert_awaited_once_with(db, user.id, EntitlementType.retest)
    assert result.kind_used == "paid_credit"


@pytest.mark.asyncio
async def test_beta_override_always_allows():
    db = AsyncMock()
    user = _make_user(beta_entitlement_override=True)

    with _mock_count(0):
        retest_gate = await can_start_retest(db, user)
        ext_gate = await can_start_extension(db, user)

    assert retest_gate.allowed is True
    assert retest_gate.reason == "beta_override"
    assert ext_gate.allowed is True
    assert ext_gate.reason == "beta_override"
