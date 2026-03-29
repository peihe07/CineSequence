from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sequencing_entitlement import EntitlementKind, SequencingEntitlement
from app.models.user import User


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


async def _find_available_entitlement(
    db: AsyncSession, user_id, kind: EntitlementKind
) -> SequencingEntitlement | None:
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
    return result.scalar_one_or_none()


def _remaining_snapshot(user: User) -> tuple[int, int]:
    return max(user.free_retest_credits, 0), max(user.paid_sequencing_credits, 0)


async def can_start_retest(db: AsyncSession, user: User) -> GateResult:
    del db
    free_remaining, paid_remaining = _remaining_snapshot(user)
    if user.beta_entitlement_override:
        return GateResult(True, "beta_override", free_remaining, paid_remaining)
    if free_remaining > 0:
        return GateResult(True, "free_retest_available", free_remaining, paid_remaining)
    if paid_remaining > 0:
        return GateResult(True, "paid_credit_available", free_remaining, paid_remaining)
    return GateResult(False, "payment_required", free_remaining, paid_remaining)


async def can_start_extension(db: AsyncSession, user: User) -> GateResult:
    del db
    free_remaining, paid_remaining = _remaining_snapshot(user)
    if user.beta_entitlement_override:
        return GateResult(True, "beta_override", free_remaining, paid_remaining)
    if paid_remaining > 0:
        return GateResult(True, "paid_credit_available", free_remaining, paid_remaining)
    return GateResult(False, "payment_required", free_remaining, paid_remaining)


async def consume_extension_credit(db: AsyncSession, user: User) -> ConsumptionResult:
    if user.beta_entitlement_override:
        free_remaining, paid_remaining = _remaining_snapshot(user)
        return ConsumptionResult("beta_override", free_remaining, paid_remaining)

    if user.paid_sequencing_credits <= 0:
        raise ValueError("No paid sequencing credits available")

    user.paid_sequencing_credits -= 1
    entitlement = await _find_available_entitlement(db, user.id, EntitlementKind.paid_credit)
    if entitlement:
        entitlement.used_quantity += 1
    await db.flush()
    free_remaining, paid_remaining = _remaining_snapshot(user)
    return ConsumptionResult("paid_credit", free_remaining, paid_remaining)


async def consume_retest_credit(db: AsyncSession, user: User) -> ConsumptionResult:
    if user.beta_entitlement_override:
        free_remaining, paid_remaining = _remaining_snapshot(user)
        return ConsumptionResult("beta_override", free_remaining, paid_remaining)

    if user.free_retest_credits > 0:
        user.free_retest_credits -= 1
        entitlement = await _find_available_entitlement(db, user.id, EntitlementKind.free_retest)
        if entitlement:
            entitlement.used_quantity += 1
        await db.flush()
        free_remaining, paid_remaining = _remaining_snapshot(user)
        return ConsumptionResult("free_retest", free_remaining, paid_remaining)

    if user.paid_sequencing_credits <= 0:
        raise ValueError("No sequencing credits available")

    user.paid_sequencing_credits -= 1
    entitlement = await _find_available_entitlement(db, user.id, EntitlementKind.paid_credit)
    if entitlement:
        entitlement.used_quantity += 1
    await db.flush()
    free_remaining, paid_remaining = _remaining_snapshot(user)
    return ConsumptionResult("paid_credit", free_remaining, paid_remaining)
