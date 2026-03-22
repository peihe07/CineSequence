"""Groups router: group discovery and membership."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.user import User
from app.services.group_engine import (
    auto_assign_groups,
    get_user_groups,
    join_group,
    leave_group,
    list_visible_groups,
)

router = APIRouter()


class GroupOut(BaseModel):
    id: str
    name: str
    subtitle: str
    icon: str
    primary_tags: list[str]
    is_hidden: bool
    member_count: int
    is_active: bool
    is_member: bool = False

    model_config = {"from_attributes": True}


@router.get("")
async def list_groups(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[GroupOut]:
    """List all visible groups with membership status."""
    groups = await list_visible_groups(db, user.id)
    return [GroupOut(**g) for g in groups]


@router.post("/auto-assign")
async def auto_assign(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[GroupOut]:
    """Auto-assign user to groups based on DNA profile."""
    if not user.dna_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete DNA sequencing first",
        )

    assigned = await auto_assign_groups(db, user)
    user_group_ids = {g.id for g in assigned}

    return [
        GroupOut(
            id=g.id,
            name=g.name,
            subtitle=g.subtitle,
            icon=g.icon,
            primary_tags=g.primary_tags or [],
            is_hidden=g.is_hidden,
            member_count=g.member_count,
            is_active=g.is_active,
            is_member=g.id in user_group_ids,
        )
        for g in assigned
    ]


@router.get("/{group_id}")
async def get_group(
    group_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GroupOut:
    """Get group details."""
    groups = await list_visible_groups(db, user.id)
    for g in groups:
        if g["id"] == group_id:
            return GroupOut(**g)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")


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

    return GroupOut(
        id=group.id,
        name=group.name,
        subtitle=group.subtitle,
        icon=group.icon,
        primary_tags=group.primary_tags or [],
        is_hidden=group.is_hidden,
        member_count=group.member_count,
        is_active=group.is_active,
        is_member=True,
    )


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

    return GroupOut(
        id=group.id,
        name=group.name,
        subtitle=group.subtitle,
        icon=group.icon,
        primary_tags=group.primary_tags or [],
        is_hidden=group.is_hidden,
        member_count=group.member_count,
        is_active=group.is_active,
        is_member=False,
    )
