"""Profile router: user profile CRUD."""

import logging
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from sqlalchemy import delete, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.deps import get_current_user, get_db
from app.models.dna_profile import DnaProfile
from app.models.group import group_members
from app.models.match import Match
from app.models.pick import Pick
from app.models.sequencing_session import SequencingSession
from app.models.user import User
from app.services.auth_cookies import clear_auth_cookie
from app.services.dna_builder import ARCHETYPES

logger = logging.getLogger(__name__)

AVATAR_MAX_BYTES = 2 * 1024 * 1024  # 2 MB
AVATAR_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

router = APIRouter()


def _with_avatar_version(url: str) -> str:
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}v={uuid.uuid4().hex}"


def _matches_avatar_signature(data: bytes, content_type: str) -> bool:
    if content_type == "image/jpeg":
        return data.startswith(b"\xff\xd8\xff")
    if content_type == "image/png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/webp":
        return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    return False


class ProfileOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    bio: str | None = None
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
    bio: str | None = None
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
    archetype_name = None
    if dna:
        for archetype in ARCHETYPES:
            if archetype["id"] == dna.archetype_id:
                archetype_name = archetype["name"]
                break
    return ProfileOut(
        id=user.id,
        email=user.email,
        name=user.name,
        bio=user.bio,
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
        archetype_name=archetype_name,
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

    allowed_fields = {
        "name", "bio", "gender", "birth_year", "region",
        "match_gender_pref", "match_age_min", "match_age_max", "pure_taste_match",
    }
    for field, value in update_data.items():
        if field not in allowed_fields:
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
    if not _matches_avatar_signature(data, file.content_type):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file content does not match its declared image type",
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

    user.avatar_url = _with_avatar_version(url)
    await db.commit()
    await db.refresh(user)
    return _user_to_profile(user)


@router.get("/export")
async def export_data(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Export all data belonging to the current user as a JSON payload."""
    dna = user.dna_profile

    picks_data = [
        {
            "round_number": p.round_number,
            "phase": p.phase,
            "movie_a_tmdb_id": p.movie_a_tmdb_id,
            "movie_b_tmdb_id": p.movie_b_tmdb_id,
            "chosen_tmdb_id": p.chosen_tmdb_id,
            "pick_mode": p.pick_mode.value if p.pick_mode else None,
            "created_at": p.created_at.isoformat(),
        }
        for p in user.picks
    ]

    dna_data = None
    if dna:
        dna_data = {
            "archetype_id": dna.archetype_id,
            "tag_vector": list(dna.tag_vector) if dna.tag_vector is not None else None,
            "personality_reading": dna.personality_reading,
            "ticket_style": dna.ticket_style,
            "created_at": dna.created_at.isoformat(),
        }

    sessions_data = [
        {
            "id": str(s.id),
            "session_type": s.session_type.value,
            "status": s.status.value,
            "total_rounds": s.total_rounds,
            "created_at": s.created_at.isoformat(),
        }
        for s in user.sessions
    ]

    # Fetch matches where this user is either party
    matches_result = await db.execute(
        Match.__table__.select().where(
            or_(Match.user_a_id == user.id, Match.user_b_id == user.id)
        )
    )
    matches_rows = matches_result.mappings().all()
    matches_data = [
        {
            "id": str(row["id"]),
            "user_a_id": str(row["user_a_id"]),
            "user_b_id": str(row["user_b_id"]),
            "similarity_score": row["similarity_score"],
            "status": row["status"].value if hasattr(row["status"], "value") else row["status"],
            "created_at": row["created_at"].isoformat(),
        }
        for row in matches_rows
    ]

    payload = {
        "profile": {
            "name": user.name,
            "email": user.email,
            "gender": user.gender.value,
            "birth_year": user.birth_year,
            "region": user.region,
            "created_at": user.created_at.isoformat(),
        },
        "picks": picks_data,
        "dna_profile": dna_data,
        "sequencing_sessions": sessions_data,
        "matches": matches_data,
    }

    return JSONResponse(content=payload, media_type="application/json")


@router.delete("")
async def delete_account(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Permanently delete the current user's account and all associated data."""
    user_id = user.id

    # 1. Remove group memberships (association table, no ORM cascade)
    await db.execute(
        delete(group_members).where(group_members.c.user_id == user_id)
    )

    # 2. Delete matches where the user is either party
    await db.execute(
        delete(Match).where(
            or_(Match.user_a_id == user_id, Match.user_b_id == user_id)
        )
    )

    # 3. Delete picks
    await db.execute(delete(Pick).where(Pick.user_id == user_id))

    # 4. Delete DNA profiles
    await db.execute(delete(DnaProfile).where(DnaProfile.user_id == user_id))

    # 5. Clear the active_session_id FK on the user row before deleting sessions
    #    (use_alter=True FK would otherwise block cascaded session deletion)
    user.active_session_id = None
    await db.flush()

    # 6. Delete sequencing sessions
    await db.execute(
        delete(SequencingSession).where(SequencingSession.user_id == user_id)
    )

    # 7. Delete the user record itself
    await db.delete(user)
    await db.commit()

    logger.info("Account deleted for user %s", user_id)

    response = Response(
        content='{"message": "Account and all associated data have been deleted"}',
        media_type="application/json",
        status_code=status.HTTP_200_OK,
    )
    clear_auth_cookie(response)
    return response
