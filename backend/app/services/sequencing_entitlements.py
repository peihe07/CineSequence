"""Sequencing entitlement gating: check and consume credits for retest/extension.

Uses user_entitlements table for all credit tracking.
"""

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sequencing_entitlement import EntitlementKind, SequencingEntitlement
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


async def _count_legacy_available(
    db: AsyncSession, user_id, kind: EntitlementKind
) -> int:
    result = await db.execute(
        select(
            func.coalesce(
                func.sum(SequencingEntitlement.quantity - SequencingEntitlement.used_quantity),
                0,
            )
        )
        .select_from(SequencingEntitlement)
        .where(
            SequencingEntitlement.user_id == user_id,
            SequencingEntitlement.kind == kind,
            SequencingEntitlement.used_quantity < SequencingEntitlement.quantity,
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


async def _consume_one_legacy(
    db: AsyncSession, user_id, kind: EntitlementKind
) -> bool:
    result = await db.execute(
        select(SequencingEntitlement)
        .where(
            SequencingEntitlement.user_id == user_id,
            SequencingEntitlement.kind == kind,
            SequencingEntitlement.used_quantity < SequencingEntitlement.quantity,
        )
        .order_by(SequencingEntitlement.created_at.asc())
        .limit(1)
    )
    ent = result.scalar_one_or_none()
    if not ent:
        return False
    ent.used_quantity += 1
    await db.flush()
    return True


async def can_start_retest(db: AsyncSession, user: User) -> GateResult:
    paid_remaining = max(
        user.paid_sequencing_credits,
        await _count_available(db, user.id, EntitlementType.retest),
        await _count_legacy_available(db, user.id, EntitlementKind.paid_credit),
    )
    free_remaining = max(
        user.free_retest_credits,
        await _count_legacy_available(db, user.id, EntitlementKind.free_retest),
    )

    if user.beta_entitlement_override:
        return GateResult(True, "beta_override", free_remaining, paid_remaining)
    if free_remaining > 0:
        return GateResult(True, "free_credit_available", free_remaining, paid_remaining)
    if paid_remaining > 0:
        return GateResult(True, "paid_credit_available", free_remaining, paid_remaining)
    return GateResult(False, "payment_required", free_remaining, paid_remaining)


async def can_start_extension(db: AsyncSession, user: User) -> GateResult:
    paid_remaining = max(
        user.paid_sequencing_credits,
        await _count_available(db, user.id, EntitlementType.extension),
        await _count_legacy_available(db, user.id, EntitlementKind.paid_credit),
    )

    if user.beta_entitlement_override:
        return GateResult(True, "beta_override", 0, paid_remaining)
    if paid_remaining > 0:
        return GateResult(True, "paid_credit_available", 0, paid_remaining)
    return GateResult(False, "payment_required", 0, paid_remaining)


async def consume_extension_credit(db: AsyncSession, user: User) -> ConsumptionResult:
    if user.beta_entitlement_override:
        paid = max(
            user.paid_sequencing_credits,
            await _count_available(db, user.id, EntitlementType.extension),
            await _count_legacy_available(db, user.id, EntitlementKind.paid_credit),
        )
        return ConsumptionResult("beta_override", 0, paid)

    consumed = False
    try:
        await _consume_one(db, user.id, EntitlementType.extension)
        consumed = True
    except ValueError:
        consumed = await _consume_one_legacy(db, user.id, EntitlementKind.paid_credit)

    if not consumed and user.paid_sequencing_credits <= 0:
        raise ValueError("No available extension entitlement")

    if user.paid_sequencing_credits > 0:
        user.paid_sequencing_credits -= 1

    paid = max(
        user.paid_sequencing_credits,
        await _count_available(db, user.id, EntitlementType.extension),
        await _count_legacy_available(db, user.id, EntitlementKind.paid_credit),
    )
    return ConsumptionResult("paid_credit", 0, paid)


async def consume_retest_credit(db: AsyncSession, user: User) -> ConsumptionResult:
    if user.beta_entitlement_override:
        paid = max(
            user.paid_sequencing_credits,
            await _count_available(db, user.id, EntitlementType.retest),
            await _count_legacy_available(db, user.id, EntitlementKind.paid_credit),
        )
        free = max(
            user.free_retest_credits,
            await _count_legacy_available(db, user.id, EntitlementKind.free_retest),
        )
        return ConsumptionResult("beta_override", free, paid)

    free_kind_used = False
    if user.free_retest_credits > 0 or await _count_legacy_available(
        db, user.id, EntitlementKind.free_retest
    ) > 0:
        if await _count_legacy_available(db, user.id, EntitlementKind.free_retest) > 0:
            await _consume_one_legacy(db, user.id, EntitlementKind.free_retest)
        if user.free_retest_credits > 0:
            user.free_retest_credits -= 1
        free_kind_used = True
    else:
        consumed = False
        try:
            await _consume_one(db, user.id, EntitlementType.retest)
            consumed = True
        except ValueError:
            consumed = await _consume_one_legacy(db, user.id, EntitlementKind.paid_credit)

        if not consumed and user.paid_sequencing_credits <= 0:
            raise ValueError("No available retest entitlement")

        if user.paid_sequencing_credits > 0:
            user.paid_sequencing_credits -= 1

    free = max(
        user.free_retest_credits,
        await _count_legacy_available(db, user.id, EntitlementKind.free_retest),
    )
    paid = max(
        user.paid_sequencing_credits,
        await _count_available(db, user.id, EntitlementType.retest),
        await _count_legacy_available(db, user.id, EntitlementKind.paid_credit),
    )
    return ConsumptionResult("free_retest" if free_kind_used else "paid_credit", free, paid)
