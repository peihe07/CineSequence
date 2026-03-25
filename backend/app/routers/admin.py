"""Admin dashboard API — stats and metrics for project maintainers."""
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.dna_profile import DnaProfile
from app.models.match import Match, MatchStatus
from app.models.user import User

router = APIRouter()


async def require_admin(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Dependency that ensures the current user is an admin."""
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


@router.get("/stats")
async def get_stats(
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Overview statistics: users, DNA, matches, funnel rates."""
    now = datetime.now(UTC)
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)

    # User counts
    total_users = await db.scalar(select(func.count(User.id)))
    users_today = await db.scalar(
        select(func.count(User.id)).where(User.created_at >= day_ago)
    )
    users_this_week = await db.scalar(
        select(func.count(User.id)).where(User.created_at >= week_ago)
    )

    # Sequencing status breakdown
    seq_result = await db.execute(
        select(
            User.sequencing_status,
            func.count(User.id),
        ).group_by(User.sequencing_status)
    )
    sequencing_breakdown = {row[0].value: row[1] for row in seq_result.all()}

    # DNA counts
    total_dna = await db.scalar(
        select(func.count(DnaProfile.id)).where(DnaProfile.is_active == True)  # noqa: E712
    )

    # Archetype distribution
    arch_result = await db.execute(
        select(
            DnaProfile.archetype_id,
            func.count(DnaProfile.id),
        ).where(DnaProfile.is_active == True)  # noqa: E712
        .group_by(DnaProfile.archetype_id)
    )
    archetype_distribution = {row[0]: row[1] for row in arch_result.all() if row[0]}

    # Match counts
    total_matches = await db.scalar(select(func.count(Match.id)))
    match_status_result = await db.execute(
        select(
            Match.status,
            func.count(Match.id),
        ).group_by(Match.status)
    )
    match_breakdown = {row[0].value: row[1] for row in match_status_result.all()}

    # Invite/accept rate
    invited_count = (
        match_breakdown.get("invited", 0)
        + match_breakdown.get("accepted", 0)
        + match_breakdown.get("declined", 0)
    )
    accepted_count = match_breakdown.get("accepted", 0)
    invite_rate = invited_count / total_matches if total_matches else 0
    accept_rate = accepted_count / invited_count if invited_count else 0

    # Funnel: registered → completed sequencing → has DNA → has match
    completed_sequencing = sequencing_breakdown.get("completed", 0)
    matched_users = union_all(
        select(Match.user_a_id.label("user_id")),
        select(Match.user_b_id.label("user_id")),
    ).subquery()
    has_match = await db.scalar(
        select(func.count(func.distinct(matched_users.c.user_id)))
    )

    return {
        "users": {
            "total": total_users,
            "today": users_today,
            "this_week": users_this_week,
            "sequencing_breakdown": sequencing_breakdown,
        },
        "dna": {
            "total_active": total_dna,
            "archetype_distribution": archetype_distribution,
        },
        "matches": {
            "total": total_matches,
            "status_breakdown": match_breakdown,
            "invite_rate": round(invite_rate, 3),
            "accept_rate": round(accept_rate, 3),
        },
        "funnel": {
            "registered": total_users,
            "completed_sequencing": completed_sequencing,
            "has_dna": total_dna,
            "has_match": has_match,
        },
    }


@router.get("/stats/daily")
async def get_daily_stats(
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = 30,
):
    """Daily breakdown of registrations, DNA builds, and matches for the last N days."""
    days = min(days, 90)
    now = datetime.now(UTC)
    start = now - timedelta(days=days)

    # Daily registrations
    reg_result = await db.execute(
        select(
            func.date_trunc("day", User.created_at).label("day"),
            func.count(User.id),
        )
        .where(User.created_at >= start)
        .group_by("day")
        .order_by("day")
    )
    registrations = [{"date": str(row[0].date()), "count": row[1]} for row in reg_result.all()]

    # Daily DNA builds
    dna_result = await db.execute(
        select(
            func.date_trunc("day", DnaProfile.created_at).label("day"),
            func.count(DnaProfile.id),
        )
        .where(DnaProfile.created_at >= start)
        .group_by("day")
        .order_by("day")
    )
    dna_builds = [{"date": str(row[0].date()), "count": row[1]} for row in dna_result.all()]

    # Daily matches
    match_result = await db.execute(
        select(
            func.date_trunc("day", Match.created_at).label("day"),
            func.count(Match.id),
        )
        .where(Match.created_at >= start)
        .group_by("day")
        .order_by("day")
    )
    matches = [{"date": str(row[0].date()), "count": row[1]} for row in match_result.all()]

    return {
        "days": days,
        "registrations": registrations,
        "dna_builds": dna_builds,
        "matches": matches,
    }


@router.get("/api-usage")
async def get_api_usage(
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Estimate external API usage based on DB records.

    - Gemini: ~1 call per DNA build (personality) + 1 per match (ice breaker) + 1 per AI pair
    - TMDB: ~2 per sequencing round (pair fetch)
    - Resend: invite sends + invite reminders + accept emails
    """
    total_dna = await db.scalar(select(func.count(DnaProfile.id)))
    total_matches = await db.scalar(select(func.count(Match.id)))
    total_invites = await db.scalar(
        select(func.count(Match.id)).where(Match.status != MatchStatus.discovered)
    )
    total_invite_reminders = await db.scalar(
        select(func.coalesce(func.sum(Match.invite_reminder_count), 0))
    )
    total_accepted = await db.scalar(
        select(func.count(Match.id)).where(Match.status == MatchStatus.accepted)
    )

    # Count AI-generated pairs (phase 2-3 rounds)
    from app.models.pick import Pick
    total_picks = await db.scalar(select(func.count(Pick.id)))

    # Rough AI pair count: phase 2-3 is rounds 6-20 = 15 rounds per session
    from app.models.sequencing_session import SequencingSession
    total_sessions = await db.scalar(select(func.count(SequencingSession.id)))
    ai_pair_calls = total_sessions * 15 if total_sessions else 0

    return {
        "gemini": {
            "personality_readings": total_dna,
            "ice_breakers": total_matches,
            "ai_pairs": ai_pair_calls,
            "estimated_total": (total_dna or 0) + (total_matches or 0) + ai_pair_calls,
        },
        "tmdb": {
            "estimated_queries": (total_picks or 0) * 2,
        },
        "resend": {
            "invite_emails": total_invites,
            "invite_reminder_emails": total_invite_reminders,
            "accepted_emails": total_accepted,
            "estimated_total": (
                (total_invites or 0)
                + (total_invite_reminders or 0)
                + (total_accepted or 0)
            ),
        },
    }
