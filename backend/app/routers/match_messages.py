"""Match message board: async messaging for accepted matches."""

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.match import Match, MatchStatus
from app.models.match_message import MatchMessage
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)

# Rate limits (messages per hour)
RATE_LIMIT_FIRST_24H = 60
RATE_LIMIT_DEFAULT = 20


class MessageOut(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    sender_name: str
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageCreateRequest(BaseModel):
    body: str = Field(min_length=1, max_length=500)


class MessageListResponse(BaseModel):
    messages: list[MessageOut]
    has_more: bool


async def _get_accepted_match(
    db: AsyncSession, match_id: uuid.UUID, user_id: uuid.UUID
) -> Match:
    """Get match if accepted and user is a participant."""
    result = await db.execute(
        select(Match).where(Match.id == match_id)
    )
    match = result.scalar_one_or_none()

    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    if match.user_a_id != user_id and match.user_b_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant")
    if match.status != MatchStatus.accepted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Message board is only available for accepted matches",
        )
    return match


async def _check_rate_limit(
    db: AsyncSession, match: Match, sender_id: uuid.UUID
) -> None:
    """Enforce per-user rate limit based on time since match acceptance."""
    now = datetime.now(UTC)
    accepted_at = match.responded_at or match.created_at

    if now - accepted_at < timedelta(hours=24):
        limit = RATE_LIMIT_FIRST_24H
    else:
        limit = RATE_LIMIT_DEFAULT

    one_hour_ago = now - timedelta(hours=1)
    result = await db.execute(
        select(func.count())
        .select_from(MatchMessage)
        .where(
            MatchMessage.match_id == match.id,
            MatchMessage.sender_id == sender_id,
            MatchMessage.created_at > one_hour_ago,
        )
    )
    count = result.scalar() or 0

    if count >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded ({limit} messages/hour)",
        )


class ConversationOut(BaseModel):
    match_id: uuid.UUID
    partner_name: str
    partner_avatar_url: str | None = None
    last_message_body: str
    last_message_at: datetime
    last_sender_id: uuid.UUID
    is_own: bool  # whether last message was sent by current user


class ConversationListResponse(BaseModel):
    conversations: list[ConversationOut]


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List accepted matches that have messages, with last message preview."""
    from sqlalchemy import and_, or_
    from sqlalchemy.orm import selectinload

    from app.services.r2_storage import normalize_public_object_url

    # Subquery: latest message per match
    latest_msg = (
        select(
            MatchMessage.match_id,
            func.max(MatchMessage.created_at).label("max_created"),
        )
        .group_by(MatchMessage.match_id)
        .subquery()
    )

    # Join to get the actual message row + match
    stmt = (
        select(Match, MatchMessage)
        .join(latest_msg, Match.id == latest_msg.c.match_id)
        .join(
            MatchMessage,
            and_(
                MatchMessage.match_id == latest_msg.c.match_id,
                MatchMessage.created_at == latest_msg.c.max_created,
            ),
        )
        .where(
            Match.status == MatchStatus.accepted,
            or_(Match.user_a_id == user.id, Match.user_b_id == user.id),
        )
        .options(
            selectinload(Match.user_a),
            selectinload(Match.user_b),
        )
        .order_by(latest_msg.c.max_created.desc())
        .limit(20)
    )
    result = await db.execute(stmt)
    rows = result.all()

    conversations: list[ConversationOut] = []
    for match, msg in rows:
        is_user_a = match.user_a_id == user.id
        partner = match.user_b if is_user_a else match.user_a
        conversations.append(ConversationOut(
            match_id=match.id,
            partner_name=partner.name,
            partner_avatar_url=normalize_public_object_url(partner.avatar_url),
            last_message_body=msg.body[:100],
            last_message_at=msg.created_at,
            last_sender_id=msg.sender_id,
            is_own=msg.sender_id == user.id,
        ))

    return ConversationListResponse(conversations=conversations)


@router.get("/{match_id}/messages", response_model=MessageListResponse)
async def list_messages(
    match_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    cursor: Annotated[datetime | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
):
    """Get messages for an accepted match, paginated by cursor."""
    match = await _get_accepted_match(db, match_id, user.id)

    query = (
        select(MatchMessage)
        .where(MatchMessage.match_id == match.id)
    )
    if cursor:
        query = query.where(MatchMessage.created_at < cursor)

    query = query.order_by(MatchMessage.created_at.desc()).limit(limit + 1)
    result = await db.execute(query)
    rows = list(result.scalars().all())

    has_more = len(rows) > limit
    messages = rows[:limit]
    # Return oldest first for display
    messages.reverse()

    return MessageListResponse(
        messages=[
            MessageOut(
                id=m.id,
                sender_id=m.sender_id,
                sender_name=m.sender.name,
                body=m.body,
                created_at=m.created_at,
            )
            for m in messages
        ],
        has_more=has_more,
    )


@router.post("/{match_id}/messages", response_model=MessageOut, status_code=201)
async def create_message(
    match_id: uuid.UUID,
    body: MessageCreateRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Send a message in an accepted match."""
    match = await _get_accepted_match(db, match_id, user.id)
    await _check_rate_limit(db, match, user.id)

    message = MatchMessage(
        match_id=match.id,
        sender_id=user.id,
        body=body.body,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)

    return MessageOut(
        id=message.id,
        sender_id=message.sender_id,
        sender_name=user.name,
        body=message.body,
        created_at=message.created_at,
    )
