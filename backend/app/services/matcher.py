"""Matcher service: find similar DNA profiles using pgvector cosine similarity."""

import uuid
from datetime import datetime

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.dna_profile import DnaProfile
from app.models.match import Match, MatchStatus
from app.models.user import User


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
        .where(User.sequencing_status == "completed")
    )

    # Apply preference filters (skip if pure_taste_match)
    if not user.pure_taste_match:
        if user.match_gender_pref and user.match_gender_pref != "any":
            q = q.where(User.gender == user.match_gender_pref)
        if user.match_age_min and user.birth_year:
            q = q.where(User.birth_year <= datetime.now().year - user.match_age_min)
        if user.match_age_max and user.birth_year:
            q = q.where(User.birth_year >= datetime.now().year - user.match_age_max)

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
    """Send an invite for a discovered match."""
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()

    if not match:
        raise ValueError("Match not found")
    if match.user_a_id != user_id and match.user_b_id != user_id:
        raise PermissionError("Not part of this match")
    if match.status != MatchStatus.discovered:
        raise ValueError(f"Cannot invite: status is {match.status}")

    match.status = MatchStatus.invited
    match.invited_at = datetime.now()
    await db.commit()
    await db.refresh(match)
    return match


async def respond_to_invite(
    db: AsyncSession,
    match_id: uuid.UUID,
    user_id: uuid.UUID,
    accept: bool,
) -> Match:
    """Accept or decline an invite."""
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()

    if not match:
        raise ValueError("Match not found")
    if match.user_a_id != user_id and match.user_b_id != user_id:
        raise PermissionError("Not part of this match")
    if match.status != MatchStatus.invited:
        raise ValueError(f"Cannot respond: status is {match.status}")

    match.status = MatchStatus.accepted if accept else MatchStatus.declined
    match.responded_at = datetime.now()
    await db.commit()
    await db.refresh(match)
    return match


def _compute_shared_tags(
    profile_a: DnaProfile, profile_b: DnaProfile, threshold: float = 0.5
) -> list[str]:
    """Find tags where both profiles have strong signals (>= threshold)."""
    import json
    from pathlib import Path

    taxonomy_path = Path(__file__).parent.parent / "data" / "tag_taxonomy.json"
    taxonomy = json.loads(taxonomy_path.read_text())
    tag_keys = list(taxonomy["tags"].keys())

    vec_a = list(profile_a.tag_vector)
    vec_b = list(profile_b.tag_vector)

    shared = []
    for i, key in enumerate(tag_keys):
        if i < len(vec_a) and i < len(vec_b):
            if vec_a[i] >= threshold and vec_b[i] >= threshold:
                shared.append(key)

    return shared


def _compute_shared_genres(
    profile_a: DnaProfile, profile_b: DnaProfile, min_freq: float = 0.15
) -> list[int]:
    """Find genres both profiles watch frequently."""
    genres_a = profile_a.genre_vector or {}
    genres_b = profile_b.genre_vector or {}

    shared = []
    for genre_id in genres_a:
        if genre_id in genres_b:
            if genres_a[genre_id] >= min_freq and genres_b[genre_id] >= min_freq:
                shared.append(int(genre_id))

    return shared


GENRE_NAMES = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
    80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
    14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
    9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 53: "Thriller",
    10752: "War", 37: "Western",
}


def _generate_ice_breakers(shared_tags: list[str], shared_genres: list[int]) -> list[str]:
    """Generate conversation starters based on shared tastes."""
    import json
    from pathlib import Path

    taxonomy_path = Path(__file__).parent.parent / "data" / "tag_taxonomy.json"
    taxonomy = json.loads(taxonomy_path.read_text())

    breakers = []

    if shared_tags:
        tag_zh = taxonomy["tags"].get(shared_tags[0], {}).get("zh", shared_tags[0])
        breakers.append(f"你們都喜歡「{tag_zh}」類型的電影，聊聊最愛的一部？")

    if len(shared_tags) >= 2:
        tag_zh = taxonomy["tags"].get(shared_tags[1], {}).get("zh", shared_tags[1])
        breakers.append(f"你們都對「{tag_zh}」有共鳴，最近有看到什麼好片嗎？")

    if shared_genres:
        genre_name = GENRE_NAMES.get(shared_genres[0], "Film")
        breakers.append(f"你們都是 {genre_name} 迷！最推薦的入門片是哪部？")

    if not breakers:
        breakers.append("你們的電影品味很互補，交換一下片單吧！")

    return breakers[:3]
