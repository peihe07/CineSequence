"""Matcher service: find similar DNA profiles using pgvector cosine + quadrant similarity."""

import json
import logging
import math
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import and_, or_, select, true
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models.dna_profile import DnaProfile
from app.models.match import Match, MatchStatus
from app.models.user import Gender, User
from app.services.email_service import send_invite_email, send_match_accepted_email

logger = logging.getLogger(__name__)

# Load archetypes and taxonomy once at module level
_data_dir = Path(__file__).parent.parent / "data"
_archetypes_raw = json.loads((_data_dir / "archetypes.json").read_text())
ARCHETYPE_MAP: dict[str, dict] = {a["id"]: a for a in _archetypes_raw}

_taxonomy = json.loads((_data_dir / "tag_taxonomy.json").read_text())
TAG_KEYS = list(_taxonomy["tags"].keys())

# Quadrant axes used for similarity calculation
QUADRANT_AXES = list(_taxonomy.get("quadrant_axes", {}).keys())

# Weight split: tag vector vs quadrant similarity
TAG_WEIGHT = 0.7
QUADRANT_WEIGHT = 0.3


def _compute_percentile_rank(score: float, all_scores: list[float]) -> int | None:
    """Return percentile rank as the share of scores less than or equal to score."""
    if not all_scores:
        return None

    lower_or_equal = sum(1 for candidate_score in all_scores if candidate_score <= score)
    return round((lower_or_equal / len(all_scores)) * 100)


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
        .where(User.is_visible == True)  # noqa: E712
    )

    # Apply current user's preference filters (skip if pure_taste_match)
    if not user.pure_taste_match:
        if user.match_gender_pref and user.match_gender_pref != "any":
            q = q.where(User.gender == user.match_gender_pref)
        current_year = datetime.now(tz=UTC).year
        if user.match_age_min:
            q = q.where(User.birth_year <= current_year - user.match_age_min)
        if user.match_age_max:
            q = q.where(User.birth_year >= current_year - user.match_age_max)

    # Also honor the candidate's reciprocal preferences unless they opted into taste-only matching.
    q = q.where(_build_reciprocal_preference_clause(user))

    # Fetch all eligible candidates so we can derive a percentile rank per match.
    q = q.order_by("distance")
    result = await db.execute(q)
    candidates = result.all()

    # Re-rank: combine tag cosine similarity with quadrant proximity
    ranked = []
    for candidate_profile, distance in candidates:
        tag_sim = 1.0 - distance
        quad_sim = _compute_quadrant_similarity(
            profile.quadrant_scores, candidate_profile.quadrant_scores
        )
        combined = TAG_WEIGHT * tag_sim + QUADRANT_WEIGHT * quad_sim
        ranked.append((candidate_profile, combined))

    all_scores = [score for _, score in ranked]
    ranked.sort(key=lambda x: x[1], reverse=True)
    ranked = ranked[:limit]

    # Create Match records
    matches = []
    for candidate_profile, similarity in ranked:
        threshold = getattr(user, "match_threshold", settings.match_threshold)
        if similarity < threshold:
            continue

        existing_pair = await db.execute(
            select(Match.id).where(
                or_(
                    and_(Match.user_a_id == user.id, Match.user_b_id == candidate_profile.user_id),
                    and_(Match.user_a_id == candidate_profile.user_id, Match.user_b_id == user.id),
                )
            )
        )
        if existing_pair.scalar_one_or_none():
            continue

        shared = _compute_shared_tags(profile, candidate_profile)
        shared_genres = _compute_shared_genres(profile, candidate_profile)
        ice_breakers = _generate_ice_breakers(shared, shared_genres)

        match = Match(
            user_a_id=user.id,
            user_b_id=candidate_profile.user_id,
            similarity_score=round(similarity, 4),
            candidate_percentile=_compute_percentile_rank(similarity, all_scores),
            candidate_pool_size=len(all_scores),
            shared_tags=shared,
            shared_movies=[],
            ice_breakers=ice_breakers,
            status=MatchStatus.discovered,
        )
        try:
            async with db.begin_nested():
                db.add(match)
                await db.flush()
            matches.append(match)
        except IntegrityError:
            logger.info(
                "Skipped duplicate match creation for pair %s <-> %s",
                user.id,
                candidate_profile.user_id,
            )

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
        .where(
            or_(
                Match.user_a_id == user_id,
                and_(
                    Match.user_b_id == user_id,
                    Match.status != MatchStatus.discovered,
                ),
            )
        )
        .order_by(Match.similarity_score.desc())
    )
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_match_by_id(
    db: AsyncSession,
    match_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Match | None:
    """Get a single match by ID, only if the user is a participant."""
    q = (
        select(Match)
        .where(
            Match.id == match_id,
            or_(Match.user_a_id == user_id, Match.user_b_id == user_id),
        )
    )
    result = await db.execute(q)
    return result.scalar_one_or_none()


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
    if match.user_a_id != user_id:
        raise PermissionError("Only the match initiator can send the invite")
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
        "inviter_archetype": get_archetype_name(inviter),
        "shared_tags": match.shared_tags or [],
        "ice_breakers": match.ice_breakers or [],
        "match_id": match.id,
    }

    match.status = MatchStatus.invited
    match.invited_at = datetime.now(tz=UTC)
    match.invite_reminder_count = 0
    match.last_invite_reminder_at = None
    await db.commit()
    await db.refresh(match)

    if recipient.email_notifications_enabled:
        try:
            await send_invite_email(**email_data)
        except Exception:
            logger.exception("Failed to send invite email for match %s", match.id)
    else:
        logger.info(
            "Skipped invite email for match %s (recipient disabled notifications)",
            match.id,
        )

    return match


async def get_pending_invite_reminders(
    db: AsyncSession,
    *,
    now: datetime | None = None,
) -> list[Match]:
    """Return invited matches due for a single reminder after 7 days."""
    current_time = now or datetime.now(tz=UTC)
    reminder_cutoff = current_time - timedelta(days=7)

    result = await db.execute(
        select(Match)
        .options(
            selectinload(Match.user_a).selectinload(User.dna_profiles),
            selectinload(Match.user_b).selectinload(User.dna_profiles),
        )
        .where(Match.status == MatchStatus.invited)
        .where(Match.responded_at.is_(None))
        .where(
            Match.invite_reminder_count == 0,
            Match.invited_at.is_not(None),
            Match.invited_at <= reminder_cutoff,
        )
        .order_by(Match.invited_at.asc())
    )
    return list(result.scalars().all())


async def mark_invite_reminder_sent(
    db: AsyncSession,
    match: Match,
    *,
    sent_at: datetime | None = None,
) -> Match:
    """Persist reminder counters after a reminder email is sent."""
    current_time = sent_at or datetime.now(tz=UTC)
    match.invite_reminder_count += 1
    match.last_invite_reminder_at = current_time
    await db.commit()
    await db.refresh(match)
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
    if match.user_b_id != user_id:
        raise PermissionError("Only the invited recipient can respond")
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
            "archetype_a": get_archetype_name(user_a),
            "archetype_b": get_archetype_name(user_b),
            "shared_tags": match.shared_tags or [],
            "ice_breakers": match.ice_breakers or [],
            "match_id": match.id,
        }

    match.status = MatchStatus.accepted if accept else MatchStatus.declined
    match.responded_at = datetime.now(tz=UTC)

    # On accept, store partner's personal ticket URLs for each side
    ticket_a_url = None
    ticket_b_url = None
    if accept:
        profile_a = user_a.dna_profile
        profile_b = user_b.dna_profile
        ticket_a_url = profile_a.personal_ticket_url if profile_a else None
        ticket_b_url = profile_b.personal_ticket_url if profile_b else None

    await db.commit()
    await db.refresh(match)

    # Send acceptance emails — each person receives the partner's personal ticket
    if email_data:
        if user_a.email_notifications_enabled:
            try:
                await send_match_accepted_email(
                    to_email=email_data["a_email"],
                    to_name=email_data["a_name"],
                    partner_name=email_data["b_name"],
                    partner_archetype=email_data["archetype_b"],
                    shared_tags=email_data["shared_tags"],
                    ice_breakers=email_data["ice_breakers"],
                    match_id=email_data["match_id"],
                    ticket_image_url=ticket_b_url,
                )
            except Exception:
                logger.exception("Failed to send accepted email to user_a for match %s", match.id)

        if user_b.email_notifications_enabled:
            try:
                await send_match_accepted_email(
                    to_email=email_data["b_email"],
                    to_name=email_data["b_name"],
                    partner_name=email_data["a_name"],
                    partner_archetype=email_data["archetype_a"],
                    shared_tags=email_data["shared_tags"],
                    ice_breakers=email_data["ice_breakers"],
                    match_id=email_data["match_id"],
                    ticket_image_url=ticket_a_url,
                )
            except Exception:
                logger.exception("Failed to send accepted email to user_b for match %s", match.id)

    return match


def _compute_quadrant_similarity(
    scores_a: dict | None, scores_b: dict | None
) -> float:
    """Compute similarity between two quadrant score dicts.

    Each axis ranges [1, 5]. We compute normalized Euclidean distance
    across the 3 axes and convert to a similarity in [0, 1].
    Max distance = sqrt(3 * 4^2) = ~6.93.
    """
    if not scores_a or not scores_b:
        return 0.5  # neutral fallback

    sum_sq = 0.0
    count = 0
    for axis in QUADRANT_AXES:
        val_a = scores_a.get(axis, 3.0)
        val_b = scores_b.get(axis, 3.0)
        sum_sq += (val_a - val_b) ** 2
        count += 1

    if count == 0:
        return 0.5

    # Max possible distance per axis is 4.0 (range 1-5)
    max_distance = math.sqrt(count * 16.0)
    distance = math.sqrt(sum_sq)
    return 1.0 - (distance / max_distance)


def _get_ticket_style(user: User) -> str:
    """Get ticket style from user's archetype."""
    profile = user.dna_profile
    if not profile:
        return "classic"
    archetype = ARCHETYPE_MAP.get(profile.archetype_id)
    if not archetype:
        return "classic"
    return archetype.get("ticket_style", "classic")


def _build_reciprocal_preference_clause(user: User):
    """Build SQL predicates for the candidate's preference rules toward the current user."""
    clauses = []

    # If the candidate wants pure taste matching, skip reciprocal demographic filters.
    clauses.append(
        or_(
            User.pure_taste_match == True,  # noqa: E712
            _build_candidate_demographic_clause(user),
        )
    )

    return and_(*clauses)


def _build_candidate_demographic_clause(user: User):
    current_year = datetime.now(tz=UTC).year
    user_birth_year = getattr(user, "birth_year", None)
    user_gender = getattr(user, "gender", None)
    user_age = current_year - user_birth_year if user_birth_year is not None else None

    # Build gender clause — prefer_not_to_say is not a valid GenderPref value,
    # so only match candidates with no preference or 'any'.
    gender_parts = [
        User.match_gender_pref.is_(None),
        User.match_gender_pref == "any",
    ]
    if user_gender is None:
        # Unknown gender: skip gender filter entirely
        gender_parts.append(true())
    elif user_gender != Gender.prefer_not_to_say:
        # Known gender that exists in GenderPref: allow exact match
        gender_parts.append(User.match_gender_pref == user_gender)
    # If prefer_not_to_say: only None/any candidates match (already in gender_parts)

    gender_clause = or_(*gender_parts)

    age_min_clause = (
        or_(User.match_age_min.is_(None), User.match_age_min <= user_age)
        if user_age is not None
        else true()
    )
    age_max_clause = (
        or_(User.match_age_max.is_(None), User.match_age_max >= user_age)
        if user_age is not None
        else true()
    )

    return and_(gender_clause, age_min_clause, age_max_clause)


def get_archetype_display_name(archetype_id: str | None) -> str:
    """Return a single display name for an archetype.

    Prefer the English label when available so English names are not prefixed
    with an extra Chinese translation in downstream UI and ticket surfaces.
    """
    if not archetype_id:
        return "電影愛好者"

    archetype = ARCHETYPE_MAP.get(archetype_id)
    if not archetype:
        return "電影愛好者"

    return archetype.get("name_en") or archetype.get("name") or "電影愛好者"


def get_archetype_name(user: User) -> str:
    """Get display name of user's archetype from their active DNA profile."""
    profile = user.dna_profile
    return get_archetype_display_name(profile.archetype_id if profile else None)


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


# TMDB zh-TW sometimes returns simplified Chinese genre names; normalize to 繁體
_GENRE_ZH_FIX: dict[str, str] = {
    "爱情": "愛情",
    "动作": "動作",
    "动画": "動畫",
    "纪录": "紀錄",
    "历史": "歷史",
    "科幻": "科幻",
    "惊悚": "驚悚",
    "战争": "戰爭",
    "犯罪": "犯罪",
    "冒险": "冒險",
    "悬疑": "懸疑",
    "音乐": "音樂",
}


def _fix_genre_zh(name: str) -> str:
    """Normalize TMDB genre name to traditional Chinese."""
    return _GENRE_ZH_FIX.get(name, name)


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
        genre_display = _fix_genre_zh(shared_genres[0])
        breakers.append(f"你們都關注「{genre_display}」類型，適合交換推薦片單。")

    if not breakers:
        breakers.append("你們的觀影光譜有所交集，不妨從各自的年度片單開始。")

    return breakers[:3]
