"""Sequencing entitlement gating: check and consume credits for retest/extension.

Uses user_entitlements table for all credit tracking.
"""

from dataclasses import dataclass
from datetime import UTC, datetime

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
    ent.consumed_at = datetime.now(UTC)
    await db.flush()


async def can_start_retest(db: AsyncSession, user: User) -> GateResult:
    paid_remaining = await _count_available(db, user.id, EntitlementType.retest)

    if user.beta_entitlement_override:
        return GateResult(True, "beta_override", 0, paid_remaining)
    if paid_remaining > 0:
        return GateResult(True, "paid_credit_available", 0, paid_remaining)
    return GateResult(False, "payment_required", 0, paid_remaining)


async def can_start_extension(db: AsyncSession, user: User) -> GateResult:
    paid_remaining = await _count_available(db, user.id, EntitlementType.extension)

    if user.beta_entitlement_override:
        return GateResult(True, "beta_override", 0, paid_remaining)
    if paid_remaining > 0:
        return GateResult(True, "paid_credit_available", 0, paid_remaining)
    return GateResult(False, "payment_required", 0, paid_remaining)


async def consume_extension_credit(db: AsyncSession, user: User) -> ConsumptionResult:
    if user.beta_entitlement_override:
        paid = await _count_available(db, user.id, EntitlementType.extension)
        return ConsumptionResult("beta_override", 0, paid)

    await _consume_one(db, user.id, EntitlementType.extension)
    paid = await _count_available(db, user.id, EntitlementType.extension)
    return ConsumptionResult("paid_credit", 0, paid)


async def consume_retest_credit(db: AsyncSession, user: User) -> ConsumptionResult:
    if user.beta_entitlement_override:
        paid = await _count_available(db, user.id, EntitlementType.retest)
        return ConsumptionResult("beta_override", 0, paid)

    await _consume_one(db, user.id, EntitlementType.retest)
    paid = await _count_available(db, user.id, EntitlementType.retest)
    return ConsumptionResult("paid_credit", 0, paid)
