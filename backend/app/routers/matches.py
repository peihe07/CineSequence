"""Matches router: find matches and manage invites."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.match import MatchStatus
from app.models.user import User
from app.services.matcher import (
    find_matches,
    get_archetype_name,
    get_match_by_id,
    get_user_matches,
    respond_to_invite,
    send_invite,
)
from app.services.notification_service import (
    emit_notification_safely,
    notify_invite_received,
    notify_match_accepted,
    notify_match_found,
)
from app.services.r2_storage import normalize_public_object_url

router = APIRouter()


class MatchOut(BaseModel):
    id: uuid.UUID
    partner_id: uuid.UUID
    partner_name: str
    partner_bio: str | None = None
    partner_avatar_url: str | None = None
    partner_archetype: str | None = None
    similarity_score: float
    candidate_percentile: int | None = None
    candidate_pool_size: int | None = None
    shared_tags: list[str]
    ice_breakers: list[str]
    status: str
    ticket_image_url: str | None = None
    is_recipient: bool

    model_config = {"from_attributes": True}


class InviteRequest(BaseModel):
    match_id: uuid.UUID


class RespondRequest(BaseModel):
    match_id: uuid.UUID
    accept: bool


def _match_to_out(match, user_id: uuid.UUID) -> MatchOut:
    """Convert Match model to MatchOut, resolving which user is the partner."""
    is_user_a = match.user_a_id == user_id
    partner = match.user_b if is_user_a else match.user_a
    is_recipient = match.user_b_id == user_id

    # Prefer the partner's personal ticket after acceptance, but keep legacy match tickets as fallback.
    partner_ticket = normalize_public_object_url(match.ticket_image_url)
    if match.status == MatchStatus.accepted:
        partner_profile = partner.dna_profile
        if partner_profile and partner_profile.personal_ticket_url:
            partner_ticket = normalize_public_object_url(partner_profile.personal_ticket_url)

    return MatchOut(
        id=match.id,
        partner_id=partner.id,
        partner_name=partner.name,
        partner_bio=partner.bio,
        partner_avatar_url=partner.avatar_url,
        partner_archetype=get_archetype_name(partner),
        similarity_score=match.similarity_score,
        candidate_percentile=match.candidate_percentile,
        candidate_pool_size=match.candidate_pool_size,
        shared_tags=match.shared_tags or [],
        ice_breakers=match.ice_breakers or [],
        status=match.status.value,
        ticket_image_url=partner_ticket,
        is_recipient=is_recipient,
    )


@router.get("")
async def list_matches(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all matches for the current user."""
    matches = await get_user_matches(db, user.id)
    return [_match_to_out(m, user.id) for m in matches]


@router.get("/{match_id}")
async def get_match(
    match_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a single match by ID (must be a participant)."""
    match = await get_match_by_id(db, match_id, user.id)
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    return _match_to_out(match, user.id)


@router.post("/discover")
async def discover_matches(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Run matching algorithm to discover new matches."""
    if not user.dna_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete DNA sequencing first",
        )

    new_matches = await find_matches(db, user)

    # Notify the current user about each new match
    for m in new_matches:
        partner = m.user_b if m.user_a_id == user.id else m.user_a
        await emit_notification_safely(
            notify_match_found,
            db,
            user.id,
            partner.name,
            m.id,
            context=f"match_found user={user.id} match={m.id}",
        )

    return [_match_to_out(m, user.id) for m in new_matches]


@router.post("/invite")
async def invite_match(
    body: InviteRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Send an invite to a discovered match."""
    try:
        match = await send_invite(db, body.match_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    # Notify the recipient about the invite
    recipient = match.user_b if match.user_a_id == user.id else match.user_a
    await emit_notification_safely(
        notify_invite_received,
        db,
        recipient.id,
        user.name,
        match.id,
        context=f"invite_received recipient={recipient.id} match={match.id}",
    )

    return _match_to_out(match, user.id)


@router.post("/respond")
async def respond_match(
    body: RespondRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Accept or decline an invite."""
    try:
        match = await respond_to_invite(db, body.match_id, user.id, body.accept)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    # Notify the inviter that their invite was accepted
    if body.accept:
        inviter = match.user_a if match.user_b_id == user.id else match.user_b
        await emit_notification_safely(
            notify_match_accepted,
            db,
            inviter.id,
            user.name,
            match.id,
            context=f"match_accepted inviter={inviter.id} match={match.id}",
        )

    return _match_to_out(match, user.id)
