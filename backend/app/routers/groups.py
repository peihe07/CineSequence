"""Groups router: group discovery and membership."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.dna_profile import DnaProfile
from app.models.group import Group
from app.models.user import User
from app.routers._group_helpers import ensure_group_visible_to_user
from app.schemas.groups import GroupOut
from app.services.group_engine import (
    auto_assign_groups,
    build_group_payload,
    join_group,
    leave_group,
    list_visible_groups,
)
from app.services.notification_service import emit_notification_safely, notify_theater_assigned

router = APIRouter()


@router.get("")
async def list_groups(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[GroupOut]:
    """List all visible groups with membership status."""
    groups = await list_visible_groups(db, user)
    return [GroupOut(**g) for g in groups]


@router.post("/auto-assign")
async def auto_assign(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[GroupOut]:
    """Auto-assign user to groups based on DNA profile."""
    profile_result = await db.execute(
        select(DnaProfile).where(
            DnaProfile.user_id == user.id,
            DnaProfile.is_active.is_(True),
        )
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete DNA sequencing first",
        )

    user.dna_profiles = [profile]
    assigned = await auto_assign_groups(db, user)
    assigned_group_refs = [(group.id, group.name) for group in assigned]
    for group_id, group_name in assigned_group_refs:
        await emit_notification_safely(
            notify_theater_assigned,
            db,
            user.id,
            theater_name=group_name,
            theater_id=group_id,
            context=f"theater_assigned:{group_id}:{user.id}",
        )
    result = await db.execute(
        select(Group).where(
            Group.id.in_([group_id for group_id, _ in assigned_group_refs])
        )
    )
    assigned_groups = list(result.scalars().all())
    user_group_ids = {group_id for group_id, _ in assigned_group_refs}
    return [
        GroupOut(
            **await build_group_payload(
                db,
                group,
                viewer=user,
                is_member=group.id in user_group_ids,
            )
        )
        for group in assigned_groups
    ]


@router.get("/{group_id}")
async def get_group(
    group_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GroupOut:
    """Get group details."""
    group, is_member = await ensure_group_visible_to_user(db, group_id=group_id, user=user)
    return GroupOut(**await build_group_payload(db, group, viewer=user, is_member=is_member))


@router.post("/{group_id}/join")
async def join(
    group_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GroupOut:
    """Join a group."""
    try:
        group = await join_group(db, user.id, group_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return GroupOut(**await build_group_payload(db, group, viewer=user, is_member=True))


@router.post("/{group_id}/leave")
async def leave(
    group_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GroupOut:
    """Leave a group."""
    try:
        group = await leave_group(db, user.id, group_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return GroupOut(**await build_group_payload(db, group, viewer=user, is_member=False))
