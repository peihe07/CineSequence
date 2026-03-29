"""Unit tests for sequencing entitlement gating and consumption."""

import pytest

from app.models.sequencing_entitlement import EntitlementKind, EntitlementSource, SequencingEntitlement
from app.models.user import Gender, User
from app.services.sequencing_entitlements import (
    can_start_extension,
    can_start_retest,
    consume_extension_credit,
    consume_retest_credit,
)


@pytest.mark.asyncio
async def test_can_start_retest_with_free_credit(db_session):
    user = User(
        email="entitlement-free@example.com",
        name="Free User",
        gender=Gender.other,
        region="TW",
        free_retest_credits=1,
        paid_sequencing_credits=0,
    )
    db_session.add(user)
    await db_session.commit()

    gate = await can_start_retest(db_session, user)

    assert gate.allowed is True
    assert gate.reason == "free_retest_available"


@pytest.mark.asyncio
async def test_can_start_extension_requires_paid_credit(db_session):
    user = User(
        email="entitlement-extend@example.com",
        name="Extend User",
        gender=Gender.other,
        region="TW",
        free_retest_credits=1,
        paid_sequencing_credits=0,
    )
    db_session.add(user)
    await db_session.commit()

    gate = await can_start_extension(db_session, user)

    assert gate.allowed is False
    assert gate.reason == "payment_required"


@pytest.mark.asyncio
async def test_consume_extension_credit_decrements_paid_credit_and_marks_ledger(db_session):
    user = User(
        email="entitlement-paid@example.com",
        name="Paid User",
        gender=Gender.other,
        region="TW",
        free_retest_credits=1,
        paid_sequencing_credits=1,
    )
    db_session.add(user)
    await db_session.flush()

    entitlement = SequencingEntitlement(
        user_id=user.id,
        kind=EntitlementKind.paid_credit,
        quantity=1,
        used_quantity=0,
        source=EntitlementSource.admin,
        notes="test grant",
    )
    db_session.add(entitlement)
    await db_session.commit()

    result = await consume_extension_credit(db_session, user)

    assert result.kind_used == "paid_credit"
    assert result.credits_remaining == 0
    await db_session.refresh(user)
    await db_session.refresh(entitlement)
    assert user.paid_sequencing_credits == 0
    assert entitlement.used_quantity == 1


@pytest.mark.asyncio
async def test_consume_retest_credit_uses_free_credit_before_paid_credit(db_session):
    user = User(
        email="entitlement-retest@example.com",
        name="Retest User",
        gender=Gender.other,
        region="TW",
        free_retest_credits=1,
        paid_sequencing_credits=2,
    )
    db_session.add(user)
    await db_session.flush()

    free_entitlement = SequencingEntitlement(
        user_id=user.id,
        kind=EntitlementKind.free_retest,
        quantity=1,
        used_quantity=0,
        source=EntitlementSource.launch_grant,
        notes="launch grant",
    )
    paid_entitlement = SequencingEntitlement(
        user_id=user.id,
        kind=EntitlementKind.paid_credit,
        quantity=2,
        used_quantity=0,
        source=EntitlementSource.admin,
        notes="test grant",
    )
    db_session.add_all([free_entitlement, paid_entitlement])
    await db_session.commit()

    result = await consume_retest_credit(db_session, user)

    assert result.kind_used == "free_retest"
    assert result.free_retests_remaining == 0
    assert result.credits_remaining == 2
    await db_session.refresh(user)
    await db_session.refresh(free_entitlement)
    await db_session.refresh(paid_entitlement)
    assert user.free_retest_credits == 0
    assert user.paid_sequencing_credits == 2
    assert free_entitlement.used_quantity == 1
    assert paid_entitlement.used_quantity == 0
