"""Profile router: user profile CRUD."""

import logging
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.deps import get_current_user, get_db
from app.models.dna_profile import DnaProfile
from app.models.group import Group, group_members
from app.models.match import Match
from app.models.pick import Pick
from app.models.sequencing_session import SequencingSession
from app.models.user import Gender, GenderPref, User
from app.models.user_favorite_movie import UserFavoriteMovie
from app.services.auth_cookies import clear_auth_cookie
from app.services.dna_builder import ARCHETYPES
from app.services.group_engine import should_activate_group
from app.services.matcher import get_archetype_display_name

logger = logging.getLogger(__name__)

# Fields that appear on the personal ticket — changes trigger regeneration
_TICKET_FIELDS = {"name", "bio"}


async def _get_favorite_movie_titles(db: AsyncSession, user_id: uuid.UUID) -> list[str]:
    result = await db.execute(
        select(UserFavoriteMovie)
        .where(UserFavoriteMovie.user_id == user_id)
        .order_by(UserFavoriteMovie.display_order)
    )
    favorites = result.scalars().all()
    return [
        favorite.title_zh or favorite.title_en
        for favorite in favorites
        if favorite.title_zh or favorite.title_en
    ]


async def _generate_personal_ticket_url(
    db: AsyncSession,
    user: User,
    profile: DnaProfile,
) -> str:
    """Generate a personal ticket URL for a user/profile pair."""
    import json

    from app.services.ticket_gen import generate_and_upload_personal_ticket

    data_dir = Path(__file__).parent.parent / "data"
    taxonomy = json.loads((data_dir / "tag_taxonomy.json").read_text())
    tag_keys = list(taxonomy["tags"].keys())

    archetype_display = get_archetype_display_name(profile.archetype_id)

    tag_vec = list(profile.tag_vector) if profile.tag_vector else []
    top_indices = sorted(range(len(tag_vec)), key=lambda i: tag_vec[i], reverse=True)
    top_tags = [
        tag_keys[i]
        for i in top_indices[:8]
        if i < len(tag_keys) and tag_vec[i] >= 0.3
    ]

    genre_vector = profile.genre_vector or {}
    top_genres = [
        genre
        for genre, score in sorted(
            genre_vector.items(),
            key=lambda item: item[1],
            reverse=True,
        )[:5]
        if score >= 0.1
    ]
    favorite_movies = await _get_favorite_movie_titles(db, user.id)

    return await generate_and_upload_personal_ticket(
        user_id=user.id,
        name=user.name,
        email=user.email,
        archetype=archetype_display,
        top_tags=top_tags,
        top_genres=top_genres,
        bio=user.bio,
        personality_reading=profile.personality_reading,
        conversation_style=profile.conversation_style,
        ticket_style=profile.ticket_style,
        avatar_url=user.avatar_url,
        favorite_movies=favorite_movies,
    )

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


class FavoriteMovieOut(BaseModel):
    id: uuid.UUID
    tmdb_id: int
    title_zh: str | None = None
    title_en: str | None = None
    poster_url: str | None = None
    display_order: int

    model_config = {"from_attributes": True}


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
    is_visible: bool = True
    email_notifications_enabled: bool = True
    sequencing_status: str
    is_admin: bool
    # DNA summary (if completed)
    archetype_id: str | None = None
    archetype_name: str | None = None
    personality_reading: str | None = None
    ticket_style: str | None = None
    personal_ticket_url: str | None = None
    # Favorites
    favorite_movies: list[FavoriteMovieOut] = []

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    name: str | None = Field(None, max_length=50)
    bio: str | None = Field(None, max_length=280)
    gender: Gender | None = None
    birth_year: int | None = None
    region: str | None = Field(None, max_length=50)
    match_gender_pref: GenderPref | None = None
    match_age_min: int | None = None
    match_age_max: int | None = None
    pure_taste_match: bool | None = None
    is_visible: bool | None = None
    email_notifications_enabled: bool | None = None

    @model_validator(mode="after")
    def validate_age_range(self):
        if self.match_age_min is not None and self.match_age_max is not None:
            if self.match_age_min > self.match_age_max:
                raise ValueError("match_age_min must be <= match_age_max")
        return self


class FavoriteMovieIn(BaseModel):
    tmdb_id: int
    title_zh: str | None = Field(None, max_length=255)
    title_en: str | None = Field(None, max_length=255)
    poster_url: str | None = Field(None, max_length=500)
    display_order: int = Field(ge=0, le=2)


class FavoriteMoviesUpdate(BaseModel):
    movies: list[FavoriteMovieIn] = Field(max_length=3)

    @model_validator(mode="after")
    def validate_unique(self):
        orders = [m.display_order for m in self.movies]
        if len(orders) != len(set(orders)):
            raise ValueError("display_order values must be unique")
        tmdb_ids = [m.tmdb_id for m in self.movies]
        if len(tmdb_ids) != len(set(tmdb_ids)):
            raise ValueError("tmdb_id values must be unique")
        return self


def _user_to_profile(user: User) -> ProfileOut:
    """Convert User model to ProfileOut, including DNA summary if available."""
    dna = user.dna_profile
    archetype_name = None
    if dna:
        for archetype in ARCHETYPES:
            if archetype["id"] == dna.archetype_id:
                archetype_name = archetype["name"]
                break
    favorites = [
        FavoriteMovieOut.model_validate(m) for m in (user.favorite_movies or [])
    ]
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
        is_visible=user.is_visible,
        email_notifications_enabled=user.email_notifications_enabled,
        sequencing_status=user.sequencing_status.value,
        is_admin=user.is_admin,
        archetype_id=dna.archetype_id if dna else None,
        archetype_name=archetype_name,
        personality_reading=dna.personality_reading if dna else None,
        ticket_style=dna.ticket_style if dna else None,
        personal_ticket_url=dna.personal_ticket_url if dna else None,
        favorite_movies=favorites,
    )


async def _refresh_group_membership_stats(
    db: AsyncSession,
    *,
    group_ids: set[str],
) -> None:
    """Recompute denormalized member counts for groups touched by account deletion."""
    if not group_ids:
        return

    result = await db.execute(select(Group).where(Group.id.in_(group_ids)))
    groups = list(result.scalars().all())
    for group in groups:
        count_result = await db.execute(
            select(func.count()).select_from(group_members).where(
                group_members.c.group_id == group.id
            )
        )
        group.member_count = count_result.scalar() or 0
        group.is_active = should_activate_group(
            group.member_count,
            group.min_members_to_activate,
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
    user_id = user.id

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    allowed_fields = {
        "name", "bio", "gender", "birth_year", "region",
        "match_gender_pref", "match_age_min", "match_age_max",
        "pure_taste_match", "is_visible", "email_notifications_enabled",
    }
    for field, value in update_data.items():
        if field not in allowed_fields:
            continue
        setattr(user, field, value)

    try:
        if update_data.keys() & _TICKET_FIELDS:
            result = await db.execute(
                select(DnaProfile)
                .where(DnaProfile.user_id == user_id)
                .where(DnaProfile.is_active.is_(True))
                .limit(1)
            )
            profile = result.scalar_one_or_none()
            if profile:
                profile.personal_ticket_url = await _generate_personal_ticket_url(db, user, profile)

        await db.commit()
        await db.refresh(user)
    except HTTPException:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        logger.exception("Failed to update profile for user %s", user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile",
        ) from None

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
    result = await db.execute(
        select(DnaProfile)
        .where(DnaProfile.user_id == user.id)
        .where(DnaProfile.is_active.is_(True))
        .limit(1)
    )
    profile = result.scalar_one_or_none()
    if profile:
        profile.personal_ticket_url = await _generate_personal_ticket_url(db, user, profile)

    await db.commit()
    await db.refresh(user)
    return _user_to_profile(user)


@router.get("/favorites")
async def get_favorites(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get user's favorite movies (up to 3)."""
    result = await db.execute(
        select(UserFavoriteMovie)
        .where(UserFavoriteMovie.user_id == user.id)
        .order_by(UserFavoriteMovie.display_order)
    )
    return [FavoriteMovieOut.model_validate(m) for m in result.scalars().all()]


@router.put("/favorites")
async def update_favorites(
    body: FavoriteMoviesUpdate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Replace user's favorite movies (max 3)."""
    # Delete existing
    await db.execute(
        delete(UserFavoriteMovie).where(UserFavoriteMovie.user_id == user.id)
    )
    # Insert new
    for movie in body.movies:
        db.add(UserFavoriteMovie(
            user_id=user.id,
            tmdb_id=movie.tmdb_id,
            title_zh=movie.title_zh,
            title_en=movie.title_en,
            poster_url=movie.poster_url,
            display_order=movie.display_order,
        ))
    result = await db.execute(
        select(DnaProfile)
        .where(DnaProfile.user_id == user.id)
        .where(DnaProfile.is_active.is_(True))
        .limit(1)
    )
    profile = result.scalar_one_or_none()
    if profile:
        profile.personal_ticket_url = await _generate_personal_ticket_url(db, user, profile)
    await db.commit()

    result = await db.execute(
        select(UserFavoriteMovie)
        .where(UserFavoriteMovie.user_id == user.id)
        .order_by(UserFavoriteMovie.display_order)
    )
    return [FavoriteMovieOut.model_validate(m) for m in result.scalars().all()]


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
    favorites_result = await db.execute(
        select(UserFavoriteMovie)
        .where(UserFavoriteMovie.user_id == user.id)
        .order_by(UserFavoriteMovie.display_order)
    )
    favorite_movies_data = [
        {
            "tmdb_id": movie.tmdb_id,
            "title_zh": movie.title_zh,
            "title_en": movie.title_en,
            "poster_url": movie.poster_url,
            "display_order": movie.display_order,
        }
        for movie in favorites_result.scalars().all()
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
        "favorite_movies": favorite_movies_data,
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
    group_id_rows = await db.execute(
        select(group_members.c.group_id).where(group_members.c.user_id == user_id)
    )
    affected_group_ids = {row[0] for row in group_id_rows}

    # 1. Remove group memberships (association table, no ORM cascade)
    await db.execute(
        delete(group_members).where(group_members.c.user_id == user_id)
    )
    await _refresh_group_membership_stats(db, group_ids=affected_group_ids)

    # 2. Delete matches where the user is either party
    await db.execute(
        delete(Match).where(
            or_(Match.user_a_id == user_id, Match.user_b_id == user_id)
        )
    )

    # 3. Delete favorite movies
    await db.execute(delete(UserFavoriteMovie).where(UserFavoriteMovie.user_id == user_id))

    # 4. Delete picks
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
