"""Groups router: group discovery and membership."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.group import group_members
from app.models.group_message import GroupMessage
from app.models.user import User
from app.services.group_engine import (
    auto_assign_groups,
    build_group_payload,
    join_group,
    leave_group,
    list_visible_groups,
)

router = APIRouter()


class GroupMemberOut(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None


class GroupMovieOut(BaseModel):
    tmdb_id: int
    title_en: str
    match_tags: list[str]


class GroupWatchlistMovieOut(GroupMovieOut):
    supporter_count: int


class GroupMessageAuthorOut(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None


class GroupMessageOut(BaseModel):
    id: str
    body: str
    created_at: str
    user: GroupMessageAuthorOut
    can_delete: bool = False


class GroupMessageCreate(BaseModel):
    body: str


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
    shared_tags: list[str] = []
    member_preview: list[GroupMemberOut] = []
    recent_messages: list[GroupMessageOut] = []
    recommended_movies: list[GroupMovieOut] = []
    shared_watchlist: list[GroupWatchlistMovieOut] = []

    model_config = {"from_attributes": True}


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
    if not user.dna_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete DNA sequencing first",
        )

    assigned = await auto_assign_groups(db, user)
    user_group_ids = {g.id for g in assigned}
    return [
        GroupOut(**await build_group_payload(db, g, viewer=user, is_member=g.id in user_group_ids))
        for g in assigned
    ]


@router.get("/{group_id}")
async def get_group(
    group_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GroupOut:
    """Get group details."""
    groups = await list_visible_groups(db, user)
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


@router.post("/{group_id}/messages", response_model=GroupMessageOut)
async def create_group_message(
    group_id: str,
    body: GroupMessageCreate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GroupMessageOut:
    """Create a new message in a group for existing members only."""
    membership = await db.execute(
        select(group_members).where(
            group_members.c.group_id == group_id,
            group_members.c.user_id == user.id,
        )
    )
    if not membership.first():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Join the theater first")

    text = body.body.strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty",
        )

    message = GroupMessage(group_id=group_id, user_id=user.id, body=text[:500])
    db.add(message)
    await db.commit()
    await db.refresh(message)

    return GroupMessageOut(
        id=str(message.id),
        body=message.body,
        created_at=message.created_at.isoformat(),
        user=GroupMessageAuthorOut(
            id=str(user.id),
            name=user.name,
            avatar_url=user.avatar_url,
        ),
        can_delete=True,
    )


@router.delete("/{group_id}/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group_message(
    group_id: str,
    message_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a group message if it belongs to the current user."""
    result = await db.execute(
        select(GroupMessage).where(
            GroupMessage.id == message_id,
            GroupMessage.group_id == group_id,
        )
    )
    message = result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    if message.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own messages",
        )

    await db.delete(message)
    await db.commit()
