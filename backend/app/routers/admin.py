"""Admin dashboard API — stats and metrics for project maintainers."""

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import delete, func, select, union_all, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.ai_token_log import AiTokenLog
from app.models.dna_profile import DnaProfile
from app.models.group import Group, group_members
from app.models.match import Match, MatchStatus
from app.models.match_message import MatchMessage
from app.models.notification import Notification, NotificationType
from app.models.pick import Pick
from app.models.sequencing_session import SequencingSession, SessionStatus
from app.models.user import SequencingStatus, User
from app.models.waitlist_entry import WaitlistEntry
from app.services.ai_token_tracker import estimate_cost_for_model
from app.services.notification_service import create_notification

logger = logging.getLogger(__name__)

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

    # Region distribution
    region_result = await db.execute(
        select(User.region, func.count(User.id)).group_by(User.region)
    )
    region_distribution = {row[0]: row[1] for row in region_result.all()}

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
    declined_count = match_breakdown.get("declined", 0)
    decided_count = accepted_count + declined_count
    invite_rate = invited_count / total_matches if total_matches else 0
    accept_rate = accepted_count / decided_count if decided_count else 0

    # Funnel: registered → completed sequencing → has DNA → has match
    completed_sequencing = sequencing_breakdown.get("completed", 0)
    matched_users = union_all(
        select(Match.user_a_id.label("user_id")),
        select(Match.user_b_id.label("user_id")),
    ).subquery()
    has_match = await db.scalar(
        select(func.count(func.distinct(matched_users.c.user_id)))
    )

    # Week-over-week trends
    two_weeks_ago = now - timedelta(days=14)
    users_last_week = await db.scalar(
        select(func.count(User.id)).where(
            User.created_at >= two_weeks_ago,
            User.created_at < week_ago,
        )
    )
    dna_this_week = await db.scalar(
        select(func.count(DnaProfile.id)).where(DnaProfile.created_at >= week_ago)
    )
    dna_last_week = await db.scalar(
        select(func.count(DnaProfile.id)).where(
            DnaProfile.created_at >= two_weeks_ago,
            DnaProfile.created_at < week_ago,
        )
    )
    matches_this_week = await db.scalar(
        select(func.count(Match.id)).where(Match.created_at >= week_ago)
    )
    matches_last_week = await db.scalar(
        select(func.count(Match.id)).where(
            Match.created_at >= two_weeks_ago,
            Match.created_at < week_ago,
        )
    )

    def calc_trend(current: int, previous: int) -> float | None:
        if not previous:
            return None
        return round(((current - previous) / previous) * 100, 1)

    return {
        "users": {
            "total": total_users,
            "today": users_today,
            "this_week": users_this_week,
            "sequencing_breakdown": sequencing_breakdown,
            "region_distribution": region_distribution,
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
        "trends": {
            "users": calc_trend(users_this_week or 0, users_last_week or 0),
            "dna": calc_trend(dna_this_week or 0, dna_last_week or 0),
            "matches": calc_trend(matches_this_week or 0, matches_last_week or 0),
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


@router.get("/waitlist")
async def get_waitlist(
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 100,
):
    """Return recent waitlist signups for admin review."""
    limit = max(1, min(limit, 500))

    total = await db.scalar(select(func.count(WaitlistEntry.id)))
    result = await db.execute(
        select(WaitlistEntry)
        .order_by(WaitlistEntry.created_at.desc(), WaitlistEntry.email.desc())
        .limit(limit)
    )
    entries = result.scalars().all()

    return {
        "total": total or 0,
        "entries": [
            {
                "email": entry.email,
                "source": entry.source,
                "created_at": entry.created_at.isoformat(),
            }
            for entry in entries
        ],
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

    # Count AI-generated pairs from actual token logs
    from app.models.pick import Pick
    total_picks = await db.scalar(select(func.count(Pick.id)))

    # Token usage from ai_token_logs
    token_stats = await db.execute(
        select(
            AiTokenLog.call_type,
            AiTokenLog.model,
            func.count(AiTokenLog.id).label("calls"),
            func.coalesce(func.sum(AiTokenLog.prompt_tokens), 0).label("prompt"),
            func.coalesce(func.sum(AiTokenLog.completion_tokens), 0).label("completion"),
            func.coalesce(func.sum(AiTokenLog.total_tokens), 0).label("total"),
        ).group_by(AiTokenLog.call_type, AiTokenLog.model)
    )
    token_by_type: dict[str, dict] = {}
    grand_prompt = 0
    grand_completion = 0
    grand_cost = 0.0
    for row in token_stats:
        type_totals = token_by_type.setdefault(
            row.call_type,
            {
                "calls": 0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0,
                "estimated_cost_usd": 0.0,
            },
        )
        type_totals["calls"] += row.calls
        type_totals["prompt_tokens"] += row.prompt
        type_totals["completion_tokens"] += row.completion
        type_totals["total_tokens"] += row.total
        type_totals["estimated_cost_usd"] += estimate_cost_for_model(
            row.prompt,
            row.completion,
            model=row.model,
        )
        grand_prompt += row.prompt
        grand_completion += row.completion
        grand_cost += estimate_cost_for_model(
            row.prompt,
            row.completion,
            model=row.model,
        )

    for type_totals in token_by_type.values():
        type_totals["estimated_cost_usd"] = round(type_totals["estimated_cost_usd"], 4)

    ai_pair_calls = token_by_type.get("ai_pair", {}).get("calls", 0)

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
            "estimated_total_cost_usd": round(grand_cost, 4),
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
    closing_zh: str = "如有任何問題或回饋，歡迎來信至 y450376@gmail.com"
    closing_en: str = "If you have any questions or feedback, please email y450376@gmail.com"
    notification_title_zh: str = "系統更新"
    notification_title_en: str = "System Update"
    notification_body_zh: str | None = None
    notification_body_en: str | None = None
    skip_notification: bool = False
    include_waitlist: bool = False
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
    waitlist_count = 0
    if body.include_waitlist:
        waitlist_count = await db.scalar(
            select(func.count(WaitlistEntry.id))
        ) or 0

    if body.dry_run:
        return {
            "dry_run": True,
            "recipient_count": recipient_count,
            "waitlist_count": waitlist_count,
            "subject": body.subject_zh,
        }

    # Create in-app notification for all users (skip if already sent)
    notification_count = 0
    if not body.skip_notification:
        result = await db.execute(select(User.id))
        user_ids = [row[0] for row in result.all()]
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

    # 直接發送 email（不經 Celery，適用於無 worker 的部署環境）
    from app.services.email_service import send_announcement_email

    sections_data = [s.model_dump() for s in body.sections]
    email_result = await db.execute(
        select(User.email).where(
            User.email_notifications_enabled.is_(True),
            User.email.isnot(None),
        )
    )
    emails = {row[0] for row in email_result.all()}

    # 加入 waitlist email（排除已註冊的）
    waitlist_sent = 0
    if body.include_waitlist:
        wl_result = await db.execute(select(WaitlistEntry.email))
        waitlist_emails = {row[0] for row in wl_result.all()} - emails
        emails = emails | waitlist_emails
    else:
        waitlist_emails = set()

    sent = 0
    failed = 0
    for email in emails:
        try:
            await send_announcement_email(
                to_email=email,
                subject_zh=body.subject_zh,
                subject_en=body.subject_en,
                body_sections=sections_data,
                closing_zh=body.closing_zh,
                closing_en=body.closing_en,
            )
            sent += 1
            if email in waitlist_emails:
                waitlist_sent += 1
        except Exception:
            logger.exception("Failed to send announcement to %s", email)
            failed += 1

    return {
        "status": "sent",
        "email_sent": sent,
        "email_failed": failed,
        "email_recipient_count": len(emails),
        "waitlist_sent": waitlist_sent,
        "notifications_created": notification_count,
    }


class ResetRequest(BaseModel):
    confirm: str  # 必須傳入 "RESET_ALL" 作為安全確認
    dry_run: bool = False


@router.post("/reset-all-sequencing")
async def reset_all_sequencing(
    body: ResetRequest,
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Bulk reset: finalize all sessions, deactivate DNA, delete matches/picks,
    and reset every user to not_started so they can redo the 30-round test.
    """
    if body.confirm != "RESET_ALL":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Pass confirm="RESET_ALL" to proceed.',
        )

    # 統計目前數量
    session_count = await db.scalar(select(func.count(SequencingSession.id))) or 0
    dna_count = await db.scalar(
        select(func.count(DnaProfile.id)).where(DnaProfile.is_active.is_(True))
    ) or 0
    match_count = await db.scalar(select(func.count(Match.id))) or 0
    pick_count = await db.scalar(select(func.count(Pick.id))) or 0
    membership_count = await db.scalar(
        select(func.count()).select_from(group_members)
    ) or 0
    user_count = await db.scalar(select(func.count(User.id))) or 0

    if body.dry_run:
        return {
            "dry_run": True,
            "sessions_to_finalize": session_count,
            "dna_to_deactivate": dna_count,
            "matches_to_delete": match_count,
            "picks_to_delete": pick_count,
            "group_memberships_to_clear": membership_count,
            "users_to_reset": user_count,
        }

    # 1. 刪除所有 match messages 和 matches
    await db.execute(MatchMessage.__table__.delete())
    await db.execute(Match.__table__.delete())

    # 2. 刪除所有 picks
    await db.execute(Pick.__table__.delete())

    # 3. 清除所有 group 成員並重設 member_count
    await db.execute(group_members.delete())
    await db.execute(
        update(Group).values(member_count=0, is_active=False)
    )

    # 4. 停用所有 DNA profiles
    await db.execute(
        update(DnaProfile)
        .where(DnaProfile.is_active.is_(True))
        .values(is_active=False)
    )

    # 5. 終結所有 sessions
    await db.execute(
        update(SequencingSession)
        .where(SequencingSession.status != SessionStatus.finalized)
        .values(status=SessionStatus.finalized)
    )

    # 6. 重設所有使用者狀態
    await db.execute(
        update(User).values(
            sequencing_status=SequencingStatus.not_started,
            active_session_id=None,
            seed_movie_tmdb_id=None,
        )
    )

    await db.commit()

    return {
        "status": "reset_complete",
        "sessions_finalized": session_count,
        "dna_deactivated": dna_count,
        "matches_deleted": match_count,
        "picks_deleted": pick_count,
        "group_memberships_cleared": membership_count,
        "users_reset": user_count,
    }


# ── Broadcast notification management ──


class BroadcastRequest(BaseModel):
    title_zh: str
    title_en: str
    body_zh: str | None = None
    body_en: str | None = None
    link: str | None = "/sequencing"
    recipients: str = "all_users"  # "all_users" | "waitlist" | "both"
    send_email: bool = False
    email_subject_zh: str | None = None
    email_subject_en: str | None = None
    email_sections: list[AnnouncementSection] | None = None
    email_closing_zh: str = "如有任何問題或回饋，歡迎來信至 y450376@gmail.com"
    email_closing_en: str = "If you have any questions or feedback, please email y450376@gmail.com"
    dry_run: bool = False


@router.post("/notifications")
async def create_broadcast(
    body: BroadcastRequest,
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a broadcast notification to selected recipients."""
    broadcast_id = str(uuid.uuid4())

    # 計算收件人
    user_ids: list[uuid.UUID] = []
    if body.recipients in ("all_users", "both"):
        result = await db.execute(select(User.id))
        user_ids = [row[0] for row in result.all()]

    waitlist_emails: set[str] = set()
    if body.recipients in ("waitlist", "both"):
        registered_result = await db.execute(select(User.email).where(User.email.isnot(None)))
        registered_emails = {row[0] for row in registered_result.all()}
        wl_result = await db.execute(select(WaitlistEntry.email))
        waitlist_emails = {row[0] for row in wl_result.all()} - registered_emails

    if body.dry_run:
        return {
            "dry_run": True,
            "broadcast_id": broadcast_id,
            "notification_count": len(user_ids),
            "waitlist_email_count": len(waitlist_emails),
        }

    # 建立 in-app notifications（bulk insert，一次 commit）
    ref_id = f"broadcast:{broadcast_id}"
    for user_id in user_ids:
        db.add(Notification(
            user_id=user_id,
            type=NotificationType.system,
            title_zh=body.title_zh,
            title_en=body.title_en,
            body_zh=body.body_zh,
            body_en=body.body_en,
            link=body.link,
            ref_id=ref_id,
        ))
    if user_ids:
        await db.commit()

    # 發送 email（如果啟用）
    email_sent = 0
    email_failed = 0
    if body.send_email:
        from app.services.email_service import send_announcement_email

        # 收集所有 email 地址
        email_result = await db.execute(
            select(User.email).where(
                User.email_notifications_enabled.is_(True),
                User.email.isnot(None),
            )
        )
        all_emails = {row[0] for row in email_result.all()}
        if body.recipients == "waitlist":
            all_emails = set()
        all_emails = all_emails | waitlist_emails

        # 如果沒有提供 email_sections，從標題和內容自動生成
        if body.email_sections:
            sections_data = [s.model_dump() for s in body.email_sections]
        else:
            sections_data = [{
                "title_zh": body.title_zh,
                "title_en": body.title_en,
                "body_zh": body.body_zh or "",
                "body_en": body.body_en or "",
            }]

        for email in all_emails:
            try:
                await send_announcement_email(
                    to_email=email,
                    subject_zh=body.email_subject_zh or body.title_zh,
                    subject_en=body.email_subject_en or body.title_en,
                    body_sections=sections_data,
                    closing_zh=body.email_closing_zh,
                    closing_en=body.email_closing_en,
                )
                email_sent += 1
            except Exception:
                logger.exception("Failed to send broadcast email to %s", email)
                email_failed += 1

    return {
        "broadcast_id": broadcast_id,
        "notifications_created": len(user_ids),
        "email_sent": email_sent,
        "email_failed": email_failed,
        "waitlist_emails": len(waitlist_emails),
    }


@router.get("/notifications")
async def list_broadcasts(
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=20, ge=1, le=100),
):
    """List broadcast notifications with read/total stats."""
    # 找出所有 broadcast ref_ids
    broadcasts_q = (
        select(
            Notification.ref_id,
            Notification.title_zh,
            Notification.title_en,
            Notification.body_zh,
            Notification.body_en,
            Notification.link,
            func.count(Notification.id).label("total"),
            func.count(Notification.id).filter(Notification.is_read.is_(True)).label("read_count"),
            func.min(Notification.created_at).label("created_at"),
        )
        .where(Notification.ref_id.like("broadcast:%"))
        .group_by(
            Notification.ref_id,
            Notification.title_zh,
            Notification.title_en,
            Notification.body_zh,
            Notification.body_en,
            Notification.link,
        )
        .order_by(func.min(Notification.created_at).desc())
        .limit(limit)
    )
    result = await db.execute(broadcasts_q)
    rows = result.all()

    return {
        "broadcasts": [
            {
                "broadcast_id": row.ref_id.replace("broadcast:", "") if row.ref_id else None,
                "title_zh": row.title_zh,
                "title_en": row.title_en,
                "body_zh": row.body_zh,
                "body_en": row.body_en,
                "link": row.link,
                "total": row.total,
                "read_count": row.read_count,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ],
    }


@router.delete("/notifications/{broadcast_id}")
async def delete_broadcast(
    broadcast_id: str,
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete all notifications belonging to a broadcast."""
    ref_id = f"broadcast:{broadcast_id}"
    result = await db.execute(
        delete(Notification).where(Notification.ref_id == ref_id)
    )
    await db.commit()

    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Broadcast not found",
        )

    return {"deleted": result.rowcount}
