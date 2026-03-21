"""Profile router: user profile CRUD."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.user import User

router = APIRouter()


class ProfileOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    avatar_url: str | None = None
    gender: str
    birth_year: int | None = None
    region: str
    match_gender_pref: str | None = None
    match_age_min: int | None = None
    match_age_max: int | None = None
    pure_taste_match: bool
    sequencing_status: str
    # DNA summary (if completed)
    archetype_id: str | None = None
    archetype_name: str | None = None
    personality_reading: str | None = None
    ticket_style: str | None = None

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    name: str | None = None
    gender: str | None = None
    birth_year: int | None = None
    region: str | None = None
    match_gender_pref: str | None = None
    match_age_min: int | None = None
    match_age_max: int | None = None
    pure_taste_match: bool | None = None


def _user_to_profile(user: User) -> ProfileOut:
    """Convert User model to ProfileOut, including DNA summary if available."""
    dna = user.dna_profile
    return ProfileOut(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        gender=user.gender.value,
        birth_year=user.birth_year,
        region=user.region,
        match_gender_pref=user.match_gender_pref.value if user.match_gender_pref else None,
        match_age_min=user.match_age_min,
        match_age_max=user.match_age_max,
        pure_taste_match=user.pure_taste_match,
        sequencing_status=user.sequencing_status.value,
        archetype_id=dna.archetype_id if dna else None,
        personality_reading=dna.personality_reading if dna else None,
        ticket_style=dna.ticket_style if dna else None,
    )


@router.get("")
async def get_profile(
    user: Annotated[User, Depends(get_current_user)],
):
    """Get current user's profile."""
    return _user_to_profile(user)


@router.patch("")
async def update_profile(
    body: ProfileUpdate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update current user's profile fields."""
    update_data = body.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return _user_to_profile(user)
