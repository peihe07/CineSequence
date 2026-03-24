"""Session service: manage sequencing session lifecycle."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dna_profile import DnaProfile
from app.models.sequencing_session import (
    EXTENSION_BATCH_SIZE,
    SequencingSession,
    SessionStatus,
    SessionType,
)


async def get_active_session(
    db: AsyncSession, user_id: uuid.UUID
) -> SequencingSession | None:
    """Get user's active (non-finalized) session, most recent first."""
    result = await db.execute(
        select(SequencingSession)
        .where(
            SequencingSession.user_id == user_id,
            SequencingSession.status.notin_([SessionStatus.finalized]),
        )
        .order_by(SequencingSession.version.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_or_create_session(
    db: AsyncSession, user_id: uuid.UUID
) -> SequencingSession:
    """Get active session or create a new initial session."""
    session = await get_active_session(db, user_id)
    if session:
        return session
    return await create_session(db, user_id, SessionType.initial)


async def create_session(
    db: AsyncSession, user_id: uuid.UUID, session_type: SessionType
) -> SequencingSession:
    """Create a new sequencing session with auto-incremented version."""
    result = await db.execute(
        select(func.coalesce(func.max(SequencingSession.version), 0))
        .where(SequencingSession.user_id == user_id)
    )
    max_version = result.scalar() or 0

    session = SequencingSession(
        user_id=user_id,
        version=max_version + 1,
        session_type=session_type,
    )
    db.add(session)
    await db.flush()
    return session


async def start_extension(
    db: AsyncSession, session: SequencingSession
) -> SequencingSession:
    """Unlock 5 more rounds for an extension batch."""
    if session.status not in (SessionStatus.completed, SessionStatus.extending):
        raise ValueError("Can only extend after completing base rounds")
    if session.extension_batches >= session.max_extension_batches:
        raise ValueError("Maximum extensions reached")

    session.extension_batches += 1
    session.total_rounds += EXTENSION_BATCH_SIZE
    session.status = SessionStatus.extending
    await db.flush()
    return session


def can_extend(session: SequencingSession) -> bool:
    """Check if session can be extended further."""
    return (
        session.status in (SessionStatus.completed, SessionStatus.extending)
        and session.extension_batches < session.max_extension_batches
    )


async def complete_base(
    db: AsyncSession, session: SequencingSession
) -> SequencingSession:
    """Mark base rounds as completed."""
    session.status = SessionStatus.completed
    await db.flush()
    return session


async def complete_extension(
    db: AsyncSession, session: SequencingSession
) -> SequencingSession:
    """Mark extension batch as completed (back to 'completed' to allow more)."""
    session.status = SessionStatus.completed
    await db.flush()
    return session


async def finalize_session(
    db: AsyncSession, session: SequencingSession
) -> SequencingSession:
    """Finalize session — no more extensions allowed."""
    session.status = SessionStatus.finalized
    await db.flush()
    return session


async def start_retest(
    db: AsyncSession, user_id: uuid.UUID
) -> SequencingSession:
    """Start a fresh sequencing session, deactivate old DNA profiles."""
    # Finalize any non-finalized sessions
    result = await db.execute(
        select(SequencingSession).where(
            SequencingSession.user_id == user_id,
            SequencingSession.status != SessionStatus.finalized,
        )
    )
    for old_session in result.scalars():
        old_session.status = SessionStatus.finalized

    # Deactivate all active DNA profiles
    result = await db.execute(
        select(DnaProfile).where(
            DnaProfile.user_id == user_id,
            DnaProfile.is_active == True,  # noqa: E712
        )
    )
    for profile in result.scalars():
        profile.is_active = False

    # Create new session
    new_session = await create_session(db, user_id, SessionType.retest)
    await db.flush()
    return new_session
