"""Matches router: find matches and manage invites."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.user import User
from app.services.matcher import find_matches, get_match_by_id, get_user_matches, respond_to_invite, send_invite

router = APIRouter()


class MatchOut(BaseModel):
    id: uuid.UUID
    partner_id: uuid.UUID
    partner_name: str
    similarity_score: float
    shared_tags: list[str]
    ice_breakers: list[str]
    status: str
    ticket_image_url: str | None = None

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

    return MatchOut(
        id=match.id,
        partner_id=partner.id,
        partner_name=partner.name,
        similarity_score=match.similarity_score,
        shared_tags=match.shared_tags or [],
        ice_breakers=match.ice_breakers or [],
        status=match.status.value,
        ticket_image_url=match.ticket_image_url,
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

    return _match_to_out(match, user.id)
