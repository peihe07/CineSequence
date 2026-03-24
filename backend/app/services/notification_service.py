"""Service for creating and querying notifications."""

import logging
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationType

logger = logging.getLogger(__name__)

NotificationCallable = Callable[..., Awaitable[Any]]


async def create_notification(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    type: NotificationType,
    title_zh: str,
    title_en: str,
    body_zh: str | None = None,
    body_en: str | None = None,
    link: str | None = None,
    ref_id: str | None = None,
) -> Notification:
    """Create a notification for a user."""
    notification = Notification(
        user_id=user_id,
        type=type,
        title_zh=title_zh,
        title_en=title_en,
        body_zh=body_zh,
        body_en=body_en,
        link=link,
        ref_id=ref_id,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification


async def emit_notification_safely(
    notifier: NotificationCallable,
    *args: Any,
    context: str,
    **kwargs: Any,
) -> Any | None:
    """Emit a notification without letting notification failures break the caller."""
    try:
        return await notifier(*args, **kwargs)
    except Exception:
        logger.exception("Notification emission failed: %s", context)
        return None


async def get_notifications(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    limit: int = 20,
    unread_only: bool = False,
) -> list[Notification]:
    """Get notifications for a user, newest first."""
    stmt = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_unread_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Get number of unread notifications."""
    from sqlalchemy import func

    stmt = (
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user_id, Notification.is_read.is_(False))
    )
    result = await db.execute(stmt)
    return result.scalar_one()


async def mark_as_read(db: AsyncSession, notification_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    """Mark a single notification as read. Returns True if updated."""
    stmt = (
        update(Notification)
        .where(Notification.id == notification_id, Notification.user_id == user_id)
        .values(is_read=True)
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.rowcount > 0


async def mark_all_as_read(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Mark all notifications as read. Returns number updated."""
    stmt = (
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.rowcount


# ── Convenience creators for specific notification types ──


async def notify_dna_ready(db: AsyncSession, user_id: uuid.UUID, archetype_id: str) -> None:
    """Notify user that their DNA profile is ready."""
    await create_notification(
        db,
        user_id=user_id,
        type=NotificationType.dna_ready,
        title_zh="你的電影 DNA 已解碼完成",
        title_en="Your Movie DNA is ready",
        body_zh="你的觀影原型已揭曉。前往查看你的 DNA 分析報告。",
        body_en="Your archetype has been revealed. View your DNA analysis report.",
        link="/dna",
        ref_id=archetype_id,
    )
    logger.info("Notification created: dna_ready for user %s", user_id)


async def notify_match_found(
    db: AsyncSession, user_id: uuid.UUID, partner_name: str, match_id: uuid.UUID
) -> None:
    """Notify user that a new match was discovered."""
    await create_notification(
        db,
        user_id=user_id,
        type=NotificationType.match_found,
        title_zh="發現新的觀影共鳴",
        title_en="New match discovered",
        body_zh=f"系統偵測到你與 {partner_name} 的觀影品味高度契合。",
        body_en=f"Your taste profile aligns with {partner_name}.",
        link="/matches",
        ref_id=str(match_id),
    )
    logger.info("Notification created: match_found for user %s", user_id)


async def notify_invite_received(
    db: AsyncSession, user_id: uuid.UUID, sender_name: str, match_id: uuid.UUID
) -> None:
    """Notify user that they received an invite."""
    await create_notification(
        db,
        user_id=user_id,
        type=NotificationType.invite_received,
        title_zh="收到觀影邀約",
        title_en="You received an invite",
        body_zh=f"{sender_name} 向你發出了觀影邀約。",
        body_en=f"{sender_name} sent you an invite.",
        link="/matches",
        ref_id=str(match_id),
    )
    logger.info("Notification created: invite_received for user %s", user_id)


async def notify_match_accepted(
    db: AsyncSession, user_id: uuid.UUID, partner_name: str, match_id: uuid.UUID
) -> None:
    """Notify user that their invite was accepted."""
    await create_notification(
        db,
        user_id=user_id,
        type=NotificationType.match_accepted,
        title_zh="觀影邀約已被接受",
        title_en="Your invite was accepted",
        body_zh=f"{partner_name} 接受了你的觀影邀約。查看你們的專屬票券。",
        body_en=f"{partner_name} accepted your invite. View your shared ticket.",
        link=f"/ticket?inviteId={match_id}",
        ref_id=str(match_id),
    )
    logger.info("Notification created: match_accepted for user %s", user_id)
