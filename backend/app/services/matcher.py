"""Matcher service: find similar DNA profiles using pgvector cosine similarity."""

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models.dna_profile import DnaProfile
from app.models.match import Match, MatchStatus
from app.models.user import User
from app.services.email_service import send_invite_email, send_match_accepted_email
from app.services.ticket_gen import generate_and_upload_ticket

logger = logging.getLogger(__name__)

# Load archetypes and taxonomy once at module level
_data_dir = Path(__file__).parent.parent / "data"
_archetypes_raw = json.loads((_data_dir / "archetypes.json").read_text())
ARCHETYPE_MAP: dict[str, dict] = {a["id"]: a for a in _archetypes_raw}

_taxonomy = json.loads((_data_dir / "tag_taxonomy.json").read_text())
TAG_KEYS = list(_taxonomy["tags"].keys())


async def find_matches(
    db: AsyncSession,
    user: User,
    limit: int = 10,
) -> list[Match]:
    """Find top matches for a user based on DNA tag_vector cosine similarity.

    Applies preference filters (gender, age) unless pure_taste_match is True.
    Skips users who already have a match record with this user.
    """
    profile = user.dna_profile
    if not profile:
        return []

    # Get existing match user IDs to exclude
    existing_q = select(Match.user_b_id).where(Match.user_a_id == user.id)
    existing_reverse_q = select(Match.user_a_id).where(Match.user_b_id == user.id)
    existing_result = await db.execute(existing_q)
    existing_reverse_result = await db.execute(existing_reverse_q)
    exclude_ids = {row[0] for row in existing_result} | {row[0] for row in existing_reverse_result}
    exclude_ids.add(user.id)

    # Build candidate query with preference filters
    q = (
        select(
            DnaProfile,
            DnaProfile.tag_vector.cosine_distance(profile.tag_vector).label("distance"),
        )
        .join(User, User.id == DnaProfile.user_id)
        .where(DnaProfile.user_id.notin_(exclude_ids))
        .where(DnaProfile.is_active == True)  # noqa: E712
        .where(User.sequencing_status == "completed")
    )

    # Apply preference filters (skip if pure_taste_match)
    if not user.pure_taste_match:
        if user.match_gender_pref and user.match_gender_pref != "any":
            q = q.where(User.gender == user.match_gender_pref)
        current_year = datetime.now(tz=timezone.utc).year
        if user.match_age_min:
            q = q.where(User.birth_year <= current_year - user.match_age_min)
        if user.match_age_max:
            q = q.where(User.birth_year >= current_year - user.match_age_max)

    q = q.order_by("distance").limit(limit)
    result = await db.execute(q)
    candidates = result.all()

    # Create Match records
    matches = []
    for candidate_profile, distance in candidates:
        similarity = 1.0 - distance
        if similarity < settings.match_threshold:
            continue

        shared = _compute_shared_tags(profile, candidate_profile)
        shared_genres = _compute_shared_genres(profile, candidate_profile)
        ice_breakers = _generate_ice_breakers(shared, shared_genres)

        match = Match(
            user_a_id=user.id,
            user_b_id=candidate_profile.user_id,
            similarity_score=round(similarity, 4),
            shared_tags=shared,
            shared_movies=[],
            ice_breakers=ice_breakers,
            status=MatchStatus.discovered,
        )
        db.add(match)
        matches.append(match)

    await db.commit()
    for m in matches:
        await db.refresh(m)

    return matches


async def get_user_matches(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> list[Match]:
    """Get all matches for a user (both as user_a and user_b)."""
    q = (
        select(Match)
        .where(or_(Match.user_a_id == user_id, Match.user_b_id == user_id))
        .order_by(Match.similarity_score.desc())
    )
    result = await db.execute(q)
    return list(result.scalars().all())


async def send_invite(
    db: AsyncSession,
    match_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Match:
    """Send an invite for a discovered match and notify recipient via email."""
    result = await db.execute(
        select(Match)
        .options(
            selectinload(Match.user_a).selectinload(User.dna_profiles),
            selectinload(Match.user_b).selectinload(User.dna_profiles),
        )
        .where(Match.id == match_id)
    )
    match = result.scalar_one_or_none()

    if not match:
        raise ValueError("Match not found")
    if match.user_a_id != user_id and match.user_b_id != user_id:
        raise PermissionError("Not part of this match")
    if match.status != MatchStatus.discovered:
        raise ValueError(f"Cannot invite: status is {match.status}")

    # Capture email data before commit (session may expire loaded relationships)
    is_user_a = match.user_a_id == user_id
    inviter = match.user_a if is_user_a else match.user_b
    recipient = match.user_b if is_user_a else match.user_a
    email_data = {
        "recipient_email": recipient.email,
        "recipient_name": recipient.name,
        "inviter_name": inviter.name,
        "inviter_archetype": _get_archetype_name(inviter),
        "shared_tags": match.shared_tags or [],
        "ice_breakers": match.ice_breakers or [],
        "match_id": match.id,
    }

    match.status = MatchStatus.invited
    match.invited_at = datetime.now(tz=timezone.utc)
    await db.commit()
    await db.refresh(match)

    try:
        await send_invite_email(**email_data)
    except Exception:
        logger.exception("Failed to send invite email for match %s", match.id)

    return match


async def respond_to_invite(
    db: AsyncSession,
    match_id: uuid.UUID,
    user_id: uuid.UUID,
    accept: bool,
) -> Match:
    """Accept or decline an invite. On accept, notify both parties via email."""
    result = await db.execute(
        select(Match)
        .options(
            selectinload(Match.user_a).selectinload(User.dna_profiles),
            selectinload(Match.user_b).selectinload(User.dna_profiles),
        )
        .where(Match.id == match_id)
    )
    match = result.scalar_one_or_none()

    if not match:
        raise ValueError("Match not found")
    if match.user_a_id != user_id and match.user_b_id != user_id:
        raise PermissionError("Not part of this match")
    if match.status != MatchStatus.invited:
        raise ValueError(f"Cannot respond: status is {match.status}")

    # Capture email data before commit
    user_a = match.user_a
    user_b = match.user_b
    email_data = None
    if accept:
        email_data = {
            "a_email": user_a.email,
            "a_name": user_a.name,
            "b_email": user_b.email,
            "b_name": user_b.name,
            "archetype_a": _get_archetype_name(user_a),
            "archetype_b": _get_archetype_name(user_b),
            "shared_tags": match.shared_tags or [],
            "ice_breakers": match.ice_breakers or [],
            "match_id": match.id,
        }

    match.status = MatchStatus.accepted if accept else MatchStatus.declined
    match.responded_at = datetime.now(tz=timezone.utc)

    # Generate ticket image on accept (fire-and-forget)
    if accept:
        try:
            ticket_style_a = _get_ticket_style(user_a)
            ticket_url = await generate_and_upload_ticket(
                match_id=match.id,
                user_a_name=user_a.name,
                user_b_name=user_b.name,
                archetype_a=_get_archetype_name(user_a),
                archetype_b=_get_archetype_name(user_b),
                shared_tags=match.shared_tags or [],
                similarity_score=match.similarity_score,
                ticket_style=ticket_style_a,
            )
            match.ticket_image_url = ticket_url
        except Exception:
            logger.exception("Failed to generate ticket for match %s", match.id)

    await db.commit()
    await db.refresh(match)

    # Send acceptance emails to both parties (fire-and-forget)
    if email_data:
        try:
            await send_match_accepted_email(
                to_email=email_data["a_email"],
                to_name=email_data["a_name"],
                partner_name=email_data["b_name"],
                partner_archetype=email_data["archetype_b"],
                shared_tags=email_data["shared_tags"],
                ice_breakers=email_data["ice_breakers"],
                match_id=email_data["match_id"],
            )
        except Exception:
            logger.exception("Failed to send accepted email to user_a for match %s", match.id)

        try:
            await send_match_accepted_email(
                to_email=email_data["b_email"],
                to_name=email_data["b_name"],
                partner_name=email_data["a_name"],
                partner_archetype=email_data["archetype_a"],
                shared_tags=email_data["shared_tags"],
                ice_breakers=email_data["ice_breakers"],
                match_id=email_data["match_id"],
            )
        except Exception:
            logger.exception("Failed to send accepted email to user_b for match %s", match.id)

    return match


def _get_ticket_style(user: User) -> str:
    """Get ticket style from user's archetype."""
    profile = user.dna_profile
    if not profile:
        return "classic"
    archetype = ARCHETYPE_MAP.get(profile.archetype_id)
    if not archetype:
        return "classic"
    return archetype.get("ticket_style", "classic")


def _get_archetype_name(user: User) -> str:
    """Get display name of user's archetype from their active DNA profile."""
    profile = user.dna_profile
    if not profile:
        return "電影愛好者"
    archetype = ARCHETYPE_MAP.get(profile.archetype_id)
    if not archetype:
        return "電影愛好者"
    return f"{archetype['name']} {archetype['name_en']}"


def _compute_shared_tags(
    profile_a: DnaProfile, profile_b: DnaProfile, threshold: float = 0.5
) -> list[str]:
    """Find tags where both profiles have strong signals (>= threshold)."""

    vec_a = list(profile_a.tag_vector)
    vec_b = list(profile_b.tag_vector)

    shared = []
    for i, key in enumerate(TAG_KEYS):
        if i < len(vec_a) and i < len(vec_b):
            if vec_a[i] >= threshold and vec_b[i] >= threshold:
                shared.append(key)

    return shared


def _compute_shared_genres(
    profile_a: DnaProfile, profile_b: DnaProfile, min_freq: float = 0.15
) -> list[str]:
    """Find genres both profiles watch frequently."""
    genres_a = profile_a.genre_vector or {}
    genres_b = profile_b.genre_vector or {}

    shared = []
    for genre_key in genres_a:
        if genre_key in genres_b:
            if genres_a[genre_key] >= min_freq and genres_b[genre_key] >= min_freq:
                shared.append(genre_key)

    return shared


GENRE_NAMES = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
    80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
    14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
    9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 53: "Thriller",
    10752: "War", 37: "Western",
}


def _generate_ice_breakers(shared_tags: list[str], shared_genres: list[str]) -> list[str]:
    """Generate conversation starters based on shared tastes."""
    breakers = []

    if shared_tags:
        tag_zh = _taxonomy["tags"].get(shared_tags[0], {}).get("zh", shared_tags[0])
        breakers.append(f"你們對「{tag_zh}」都有偏好，可以從各自的片單切入。")

    if len(shared_tags) >= 2:
        tag_zh = _taxonomy["tags"].get(shared_tags[1], {}).get("zh", shared_tags[1])
        breakers.append(f"「{tag_zh}」是你們的共同語言，聊聊近期印象深刻的作品。")

    if shared_genres:
        breakers.append(f"你們都關注「{shared_genres[0]}」類型，適合交換推薦片單。")

    if not breakers:
        breakers.append("你們的觀影光譜有所交集，不妨從各自的年度片單開始。")

    return breakers[:3]
