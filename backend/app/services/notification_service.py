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


async def _rollback_async_sessions(*values: Any) -> None:
    """Rollback any AsyncSession objects embedded in the provided values."""
    for value in values:
        if isinstance(value, AsyncSession):
            try:
                await value.rollback()
            except Exception:
                logger.exception("Failed to rollback async session after notification failure")
        elif isinstance(value, dict):
            await _rollback_async_sessions(*value.values())
        elif isinstance(value, (list, tuple, set)):
            await _rollback_async_sessions(*value)


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
        await _rollback_async_sessions(args, kwargs)
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
        title_zh="DNA 解密完成",
        title_en="DNA DECLASSIFIED",
        body_zh="你的觀影原型已歸檔。立即前往查看完整 DNA 報告。",
        body_en="Your archetype is now on file. Open the full DNA report.",
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
        title_zh="偵測到新的共鳴對象",
        title_en="SIGNAL MATCH DETECTED",
        body_zh=f"系統已將 {partner_name} 標記為高共鳴目標，檔案待你查閱。",
        body_en=f"{partner_name} has been flagged as a high-resonance contact. Review the dossier.",
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
        title_zh="收到新的通聯請求",
        title_en="INCOMING CLEARANCE REQUEST",
        body_zh=f"{sender_name} 已向你發送觀影通聯請求。",
        body_en=f"{sender_name} sent a viewing-channel request.",
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
        title_zh="通聯已建立",
        title_en="CONTACT ESTABLISHED",
        body_zh=f"{partner_name} 已接受邀約。共享票券與聯絡通道現已開啟。",
        body_en=f"{partner_name} accepted your request. Shared ticket and channel now open.",
        link=f"/ticket?inviteId={match_id}",
        ref_id=str(match_id),
    )
    logger.info("Notification created: match_accepted for user %s", user_id)


async def notify_theater_assigned(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    theater_name: str,
    theater_id: str,
) -> None:
    """Notify user that DNA assigned them into a theater."""
    await create_notification(
        db,
        user_id=user_id,
        type=NotificationType.theater_assigned,
        title_zh="收到新的放映廳指派",
        title_en="ASSIGNMENT ORDER ISSUED",
        body_zh=f"你的 DNA 路徑已將你導向「{theater_name}」。立即進入並查看本廳片單。",
        body_en=(
            f'Your DNA route now points to "{theater_name}". '
            "Enter the room and inspect the slate."
        ),
        link=f"/theaters/detail?id={theater_id}",
        ref_id=f"assigned:{theater_id}",
    )
    logger.info(
        "Notification created: theater_assigned for user %s theater %s", user_id, theater_id
    )


async def notify_theater_activity(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    actor_name: str,
    theater_id: str,
    list_id: str,
    list_title: str,
    activity_type: str,
) -> None:
    """Notify room members about new list activity."""
    if activity_type == "list_created":
        title_zh = "放映廳收到新的片單訊號"
        title_en = "THEATER DISPATCH RECEIVED"
        body_zh = f'{actor_name} 已在本廳建立片單「{list_title}」。'
        body_en = f'{actor_name} opened a new slate: "{list_title}".'
    else:
        title_zh = "放映廳收到新的回覆訊號"
        title_en = "THEATER REPLY DETECTED"
        body_zh = f'{actor_name} 已回覆片單「{list_title}」。'
        body_en = f'{actor_name} replied to the slate "{list_title}".'

    await create_notification(
        db,
        user_id=user_id,
        type=NotificationType.theater_activity,
        title_zh=title_zh,
        title_en=title_en,
        body_zh=body_zh,
        body_en=body_en,
        link=f"/theaters/detail?id={theater_id}",
        ref_id=f"{activity_type}:{list_id}:{user_id}",
    )
    logger.info(
        "Notification created: theater_activity for user %s theater %s list %s",
        user_id,
        theater_id,
        list_id,
    )
