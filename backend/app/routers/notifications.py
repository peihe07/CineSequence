"""Notifications router: list, read, and manage notifications."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.notification import NotificationType
from app.models.user import User
from app.services.notification_service import (
    get_notifications,
    get_unread_count,
    mark_all_as_read,
    mark_as_read,
)

router = APIRouter()


class NotificationOut(BaseModel):
    id: uuid.UUID
    type: NotificationType
    title_zh: str
    title_en: str
    body_zh: str | None = None
    body_en: str | None = None
    link: str | None = None
    is_read: bool
    created_at: str

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    notifications: list[NotificationOut]
    unread_count: int


def _to_out(n) -> NotificationOut:
    return NotificationOut(
        id=n.id,
        type=n.type,
        title_zh=n.title_zh,
        title_en=n.title_en,
        body_zh=n.body_zh,
        body_en=n.body_en,
        link=n.link,
        is_read=n.is_read,
        created_at=n.created_at.isoformat(),
    )


@router.get("")
async def list_notifications(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=20, ge=1, le=50),
    unread_only: bool = Query(default=False),
) -> NotificationListResponse:
    """List notifications for the current user."""
    notifications = await get_notifications(db, user.id, limit=limit, unread_only=unread_only)
    unread = await get_unread_count(db, user.id)
    return NotificationListResponse(
        notifications=[_to_out(n) for n in notifications],
        unread_count=unread,
    )


@router.get("/unread-count")
async def notification_unread_count(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get unread notification count (lightweight endpoint for polling)."""
    count = await get_unread_count(db, user.id)
    return {"unread_count": count}


@router.patch("/{notification_id}/read")
async def read_notification(
    notification_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Mark a single notification as read."""
    updated = await mark_as_read(db, notification_id, user.id)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return {"ok": True}


@router.patch("/read-all")
async def read_all_notifications(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Mark all notifications as read."""
    count = await mark_all_as_read(db, user.id)
    return {"ok": True, "updated": count}
