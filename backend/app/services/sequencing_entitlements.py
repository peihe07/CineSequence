"""Sequencing entitlement gating: check and consume credits for retest/extension.

Uses user_entitlements table for paid credits, and users.free_retest_credits
as a legacy fallback (will be 0 for all users after relaunch reset).
"""

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.user_entitlement import EntitlementStatus, EntitlementType, UserEntitlement


@dataclass(slots=True)
class GateResult:
    allowed: bool
    reason: str
    free_retests_remaining: int
    paid_credits_remaining: int
    credits_required: int = 1


@dataclass(slots=True)
class ConsumptionResult:
    kind_used: str
    free_retests_remaining: int
    credits_remaining: int


async def _count_available(
    db: AsyncSession, user_id, ent_type: EntitlementType
) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(UserEntitlement)
        .where(
            UserEntitlement.user_id == user_id,
            UserEntitlement.type == ent_type,
            UserEntitlement.status == EntitlementStatus.available,
        )
    )
    return result.scalar() or 0


async def _consume_one(
    db: AsyncSession, user_id, ent_type: EntitlementType
) -> None:
    """Consume the oldest available entitlement of the given type."""
    result = await db.execute(
        select(UserEntitlement)
        .where(
            UserEntitlement.user_id == user_id,
            UserEntitlement.type == ent_type,
            UserEntitlement.status == EntitlementStatus.available,
        )
        .order_by(UserEntitlement.created_at.asc())
        .limit(1)
    )
    ent = result.scalar_one_or_none()
    if not ent:
        raise ValueError(f"No available {ent_type} entitlement")
    ent.status = EntitlementStatus.consumed
    ent.consumed_at = datetime.now(timezone.utc)
    await db.flush()


async def can_start_retest(db: AsyncSession, user: User) -> GateResult:
    free_remaining = max(user.free_retest_credits, 0)
    paid_remaining = await _count_available(db, user.id, EntitlementType.retest)

    if user.beta_entitlement_override:
        return GateResult(True, "beta_override", free_remaining, paid_remaining)
    if free_remaining > 0:
        return GateResult(True, "free_retest_available", free_remaining, paid_remaining)
    if paid_remaining > 0:
        return GateResult(True, "paid_credit_available", free_remaining, paid_remaining)
    return GateResult(False, "payment_required", free_remaining, paid_remaining)


async def can_start_extension(db: AsyncSession, user: User) -> GateResult:
    free_remaining = max(user.free_retest_credits, 0)
    paid_remaining = await _count_available(db, user.id, EntitlementType.extension)

    if user.beta_entitlement_override:
        return GateResult(True, "beta_override", free_remaining, paid_remaining)
    if paid_remaining > 0:
        return GateResult(True, "paid_credit_available", free_remaining, paid_remaining)
    return GateResult(False, "payment_required", free_remaining, paid_remaining)


async def consume_extension_credit(db: AsyncSession, user: User) -> ConsumptionResult:
    if user.beta_entitlement_override:
        paid = await _count_available(db, user.id, EntitlementType.extension)
        return ConsumptionResult("beta_override", max(user.free_retest_credits, 0), paid)

    await _consume_one(db, user.id, EntitlementType.extension)
    paid = await _count_available(db, user.id, EntitlementType.extension)
    return ConsumptionResult("paid_credit", max(user.free_retest_credits, 0), paid)


async def consume_retest_credit(db: AsyncSession, user: User) -> ConsumptionResult:
    if user.beta_entitlement_override:
        paid = await _count_available(db, user.id, EntitlementType.retest)
        return ConsumptionResult("beta_override", max(user.free_retest_credits, 0), paid)

    # Legacy free retest path (will be 0 after relaunch)
    if user.free_retest_credits > 0:
        user.free_retest_credits -= 1
        await db.flush()
        paid = await _count_available(db, user.id, EntitlementType.retest)
        return ConsumptionResult(
            "free_retest", max(user.free_retest_credits, 0), paid
        )

    await _consume_one(db, user.id, EntitlementType.retest)
    paid = await _count_available(db, user.id, EntitlementType.retest)
    return ConsumptionResult("paid_credit", max(user.free_retest_credits, 0), paid)
