"""Admin dashboard API — stats and metrics for project maintainers."""

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.ai_token_log import AiTokenLog
from app.models.dna_profile import DnaProfile
from app.models.match import Match, MatchStatus
from app.models.notification import NotificationType
from app.models.user import User
from app.services.ai_token_tracker import estimate_cost
from app.services.notification_service import create_notification

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

    # Rough AI pair count: phase 2-3 is rounds 8-30 = 23 rounds per session
    from app.models.sequencing_session import SequencingSession
    total_sessions = await db.scalar(select(func.count(SequencingSession.id)))
    ai_pair_calls = total_sessions * 23 if total_sessions else 0

    # Token usage from ai_token_logs
    token_stats = await db.execute(
        select(
            AiTokenLog.call_type,
            func.count(AiTokenLog.id).label("calls"),
            func.coalesce(func.sum(AiTokenLog.prompt_tokens), 0).label("prompt"),
            func.coalesce(func.sum(AiTokenLog.completion_tokens), 0).label("completion"),
            func.coalesce(func.sum(AiTokenLog.total_tokens), 0).label("total"),
        ).group_by(AiTokenLog.call_type)
    )
    token_by_type: dict[str, dict] = {}
    grand_prompt = 0
    grand_completion = 0
    for row in token_stats:
        token_by_type[row.call_type] = {
            "calls": row.calls,
            "prompt_tokens": row.prompt,
            "completion_tokens": row.completion,
            "total_tokens": row.total,
            "estimated_cost_usd": round(estimate_cost(row.prompt, row.completion), 4),
        }
        grand_prompt += row.prompt
        grand_completion += row.completion

    return {
        "gemini": {
            "personality_readings": total_dna,
            "ice_breakers": total_matches,
            "ai_pairs": ai_pair_calls,
            "estimated_total": (total_dna or 0) + (total_matches or 0) + ai_pair_calls,
            "token_usage": token_by_type,
            "total_prompt_tokens": grand_prompt,
            "total_completion_tokens": grand_completion,
            "total_tokens": grand_prompt + grand_completion,
            "estimated_total_cost_usd": round(
                estimate_cost(grand_prompt, grand_completion), 4
            ),
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


class AnnouncementSection(BaseModel):
    title_zh: str
    title_en: str
    body_zh: str
    body_en: str


class AnnouncementRequest(BaseModel):
    subject_zh: str
    subject_en: str
    sections: list[AnnouncementSection]
    closing_zh: str = "如有任何問題或回饋，歡迎直接回覆此信。"
    closing_en: str = "If you have any questions or feedback, feel free to reply to this email."
    notification_title_zh: str = "系統更新"
    notification_title_en: str = "System Update"
    notification_body_zh: str | None = None
    notification_body_en: str | None = None
    dry_run: bool = False


@router.post("/announce")
async def send_announcement(
    body: AnnouncementRequest,
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Send system announcement email to all users + create in-app notifications.

    Set dry_run=true to preview recipient count without sending.
    """
    # Count eligible recipients
    recipient_count = await db.scalar(
        select(func.count(User.id)).where(
            User.email_notifications_enabled.is_(True),
            User.email.isnot(None),
        )
    )

    if body.dry_run:
        return {
            "dry_run": True,
            "recipient_count": recipient_count,
            "subject": body.subject_zh,
        }

    # Create in-app notification for all users
    result = await db.execute(select(User.id))
    user_ids = [row[0] for row in result.all()]
    notification_count = 0
    for user_id in user_ids:
        await create_notification(
            db,
            user_id=user_id,
            type=NotificationType.system,
            title_zh=body.notification_title_zh,
            title_en=body.notification_title_en,
            body_zh=body.notification_body_zh or body.subject_zh,
            body_en=body.notification_body_en or body.subject_en,
            link="/sequencing",
        )
        notification_count += 1

    # Enqueue email task via Celery
    from app.tasks.email_tasks import send_announcement_task

    sections_data = [s.model_dump() for s in body.sections]
    task = send_announcement_task.delay(
        subject_zh=body.subject_zh,
        subject_en=body.subject_en,
        body_sections=sections_data,
        closing_zh=body.closing_zh,
        closing_en=body.closing_en,
    )

    return {
        "status": "queued",
        "task_id": task.id,
        "email_recipient_count": recipient_count,
        "notifications_created": notification_count,
    }
