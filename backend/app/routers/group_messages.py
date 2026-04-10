"""Group messages router: send and delete messages within a group."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.group_message import GroupMessage
from app.models.user import User
from app.routers._group_helpers import require_group_membership
from app.schemas.groups import GroupMessageAuthorOut, GroupMessageCreate, GroupMessageOut
from app.services.r2_storage import normalize_public_object_url

router = APIRouter()


@router.post("/{group_id}/messages", response_model=GroupMessageOut)
async def create_group_message(
    group_id: str,
    body: GroupMessageCreate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GroupMessageOut:
    """Create a new message in a group for existing members only."""
    await require_group_membership(db, group_id=group_id, user_id=user.id)

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
            avatar_url=normalize_public_object_url(user.avatar_url),
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
