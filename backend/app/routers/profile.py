"""Profile router: user profile CRUD."""

import logging
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.deps import get_current_user, get_db
from app.models.user import User

logger = logging.getLogger(__name__)

AVATAR_MAX_BYTES = 2 * 1024 * 1024  # 2 MB
AVATAR_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

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

    ALLOWED_FIELDS = {
        "name", "gender", "birth_year", "region",
        "match_gender_pref", "match_age_min", "match_age_max", "pure_taste_match",
    }
    for field, value in update_data.items():
        if field not in ALLOWED_FIELDS:
            continue
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return _user_to_profile(user)


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Upload avatar image. Accepts JPEG, PNG, WebP up to 2 MB."""
    if file.content_type not in AVATAR_ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG, and WebP images are allowed",
        )

    data = await file.read()
    if len(data) > AVATAR_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size must be under 2 MB",
        )

    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[file.content_type]
    key = f"avatars/{user.id}.{ext}"

    if not settings.s3_endpoint:
        # Dev mode: save locally and serve via static
        local_dir = Path("output") / "avatars"
        local_dir.mkdir(parents=True, exist_ok=True)
        (local_dir / f"{user.id}.{ext}").write_bytes(data)
        url = f"{settings.api_url}/static/avatars/{user.id}.{ext}"
        logger.info("Dev mode: saved avatar locally for user %s", user.id)
    else:
        from app.services.r2_storage import upload_bytes
        url = await upload_bytes(data, key, content_type=file.content_type)

    user.avatar_url = url
    await db.commit()
    await db.refresh(user)
    return _user_to_profile(user)
