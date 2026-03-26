"""Group engine: auto-assign users to groups based on DNA tag affinity."""

import json
import logging
import uuid
from pathlib import Path

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.group import Group, group_members
from app.models.group_message import GroupMessage
from app.models.user import User
from app.services.r2_storage import normalize_public_object_url

logger = logging.getLogger(__name__)

# Load tag taxonomy for index mapping
_data_dir = Path(__file__).parent.parent / "data"
_taxonomy = json.loads((_data_dir / "tag_taxonomy.json").read_text())
TAG_KEYS = list(_taxonomy["tags"].keys())
TAG_INDEX = {key: i for i, key in enumerate(TAG_KEYS)}
_movie_pool = json.loads((_data_dir / "movie_pool.json").read_text())["movies"]

# Minimum affinity score to auto-assign a user to a group
AUTO_ASSIGN_THRESHOLD = 0.2


def should_activate_group(member_count: int, min_members_to_activate: int) -> bool:
    """Return whether a group should be active for the current member count."""
    return member_count >= min_members_to_activate


def compute_group_affinity(tag_vector: list[float], primary_tags: list[str]) -> float:
    """Compute affinity score between a user's tag_vector and a group's primary_tags.

    Returns average tag_vector value for the group's primary_tags.
    Higher = stronger match.
    """
    if not primary_tags or not tag_vector:
        return 0.0

    total = 0.0
    count = 0
    for tag in primary_tags:
        idx = TAG_INDEX.get(tag)
        if idx is not None and idx < len(tag_vector):
            total += tag_vector[idx]
            count += 1

    return total / count if count > 0 else 0.0


def get_shared_tags(tag_vector: list[float], primary_tags: list[str], limit: int = 3) -> list[str]:
    """Return the strongest overlapping tags between a user and a group."""
    scored = []
    for tag in primary_tags:
        idx = TAG_INDEX.get(tag)
        if idx is None or idx >= len(tag_vector):
            continue
        score = float(tag_vector[idx])
        if score > 0:
            scored.append((score, tag))
    scored.sort(key=lambda item: (-item[0], item[1]))
    return [tag for _, tag in scored[:limit]]


def recommend_movies_for_group(
    primary_tags: list[str],
    tag_vector: list[float] | None = None,
    limit: int = 3,
) -> list[dict]:
    """Pick a few representative movies for a group from the curated pool."""
    tag_vector = tag_vector or []
    scored_movies: list[tuple[float, dict]] = []

    for movie in _movie_pool:
        overlap = [tag for tag in movie.get("tags", []) if tag in primary_tags]
        if not overlap:
            continue

        viewer_bonus = 0.0
        for tag in overlap:
            idx = TAG_INDEX.get(tag)
            if idx is not None and idx < len(tag_vector):
                viewer_bonus += float(tag_vector[idx])

        score = (
            len(overlap) * 2.0
            + viewer_bonus
            + (0.2 if movie.get("region") not in ("us", "uk") else 0.0)
        )
        scored_movies.append((score, {
            "tmdb_id": movie["tmdb_id"],
            "title_en": movie["title_en"],
            "match_tags": overlap[:3],
        }))

    scored_movies.sort(key=lambda item: (-item[0], item[1]["title_en"]))
    return [movie for _, movie in scored_movies[:limit]]


def _movie_member_resonance(
    member_vectors: list[list[float]],
    movie_tags: list[str],
) -> tuple[float, int]:
    """Return average resonance and supporter count for a movie across members."""
    if not member_vectors or not movie_tags:
        return 0.0, 0

    member_scores: list[float] = []
    for vector in member_vectors:
        overlap_scores = []
        for tag in movie_tags:
            idx = TAG_INDEX.get(tag)
            if idx is not None and idx < len(vector):
                overlap_scores.append(float(vector[idx]))
        if not overlap_scores:
            continue
        member_scores.append(sum(overlap_scores) / len(overlap_scores))

    if not member_scores:
        return 0.0, 0

    average = sum(member_scores) / len(member_scores)
    supporters = sum(1 for score in member_scores if score >= 0.35)
    return average, supporters


def build_shared_watchlist(
    primary_tags: list[str],
    member_vectors: list[list[float]],
    limit: int = 5,
) -> list[dict]:
    """Build a group-facing watchlist ranked by shared member resonance."""
    scored_movies: list[tuple[float, dict]] = []

    for movie in _movie_pool:
        overlap = [tag for tag in movie.get("tags", []) if tag in primary_tags]
        if not overlap:
            continue

        avg_resonance, supporter_count = _movie_member_resonance(member_vectors, overlap)
        score = (
            len(overlap) * 2.0
            + avg_resonance * 3.0
            + supporter_count * 0.6
            + (0.15 if movie.get("region") not in ("us", "uk") else 0.0)
        )

        scored_movies.append((score, {
            "tmdb_id": movie["tmdb_id"],
            "title_en": movie["title_en"],
            "match_tags": overlap[:3],
            "supporter_count": supporter_count,
        }))

    scored_movies.sort(
        key=lambda item: (
            -item[0],
            -item[1]["supporter_count"],
            item[1]["title_en"],
        )
    )
    return [movie for _, movie in scored_movies[:limit]]


async def _member_preview(
    db: AsyncSession,
    group_id: str,
    limit: int = 6,
) -> list[dict]:
    result = await db.execute(
        select(User)
        .join(group_members, group_members.c.user_id == User.id)
        .where(group_members.c.group_id == group_id)
        .order_by(User.name.asc())
        .limit(limit)
    )
    members = result.scalars().all()
    return [
        {
            "id": str(member.id),
            "name": member.name,
            "avatar_url": normalize_public_object_url(member.avatar_url),
        }
        for member in members
    ]


async def _group_members(
    db: AsyncSession,
    group_id: str,
) -> list[User]:
    result = await db.execute(
        select(User)
        .join(group_members, group_members.c.user_id == User.id)
        .where(group_members.c.group_id == group_id)
        .order_by(User.name.asc())
    )
    return list(result.scalars().all())


async def _recent_messages(
    db: AsyncSession,
    group_id: str,
    viewer_id=None,
    limit: int = 8,
) -> list[dict]:
    result = await db.execute(
        select(GroupMessage, User)
        .join(User, User.id == GroupMessage.user_id)
        .where(GroupMessage.group_id == group_id)
        .order_by(GroupMessage.created_at.desc())
        .limit(limit)
    )
    rows = result.all()
    messages = [
        {
            "id": str(message.id),
            "body": message.body,
            "created_at": message.created_at.isoformat(),
            "user": {
                "id": str(author.id),
                "name": author.name,
                "avatar_url": normalize_public_object_url(author.avatar_url),
            },
            "can_delete": viewer_id == author.id,
        }
        for message, author in rows
    ]
    return list(reversed(messages))


async def build_group_payload(
    db: AsyncSession,
    group: Group,
    viewer: User | None = None,
    is_member: bool = False,
) -> dict:
    """Serialize a group with useful theater-facing details."""
    profile = viewer.dna_profile if viewer else None
    tag_vector = list(profile.tag_vector) if profile and profile.tag_vector is not None else []
    members = await _group_members(db, group.id)
    member_vectors = [
        list(member.dna_profile.tag_vector)
        for member in members
        if member.dna_profile and member.dna_profile.tag_vector is not None
    ]

    return {
        "id": group.id,
        "name": group.name,
        "subtitle": group.subtitle,
        "icon": group.icon,
        "primary_tags": group.primary_tags or [],
        "is_hidden": group.is_hidden,
        "member_count": group.member_count,
        "is_active": group.is_active,
        "is_member": is_member,
        "shared_tags": get_shared_tags(tag_vector, group.primary_tags or []),
        "member_preview": [
            {
                "id": str(member.id),
                "name": member.name,
                "avatar_url": normalize_public_object_url(member.avatar_url),
            }
            for member in members[:6]
        ],
        "recent_messages": await _recent_messages(
            db,
            group.id,
            viewer_id=viewer.id if viewer else None,
        ),
        "recommended_movies": recommend_movies_for_group(group.primary_tags or [], tag_vector),
        "shared_watchlist": build_shared_watchlist(group.primary_tags or [], member_vectors),
    }


async def auto_assign_groups(
    db: AsyncSession,
    user: User,
) -> list[Group]:
    """Auto-assign user to groups based on their DNA tag_vector affinity.

    Clears existing memberships and re-assigns based on current DNA profile.
    Returns list of groups the user was assigned to.
    """
    profile = user.dna_profile
    if not profile or profile.tag_vector is None:
        return []

    tag_vector = list(profile.tag_vector)

    # Fetch all groups
    result = await db.execute(select(Group))
    all_groups = list(result.scalars().all())

    # Clear existing memberships for this user
    await db.execute(
        delete(group_members).where(group_members.c.user_id == user.id)
    )

    assigned = []
    for group in all_groups:
        affinity = compute_group_affinity(tag_vector, group.primary_tags or [])
        if affinity >= AUTO_ASSIGN_THRESHOLD:
            await db.execute(
                group_members.insert().values(user_id=user.id, group_id=group.id)
            )
            assigned.append(group)

    # Update member counts for all groups
    for group in all_groups:
        count_q = select(func.count()).select_from(group_members).where(
            group_members.c.group_id == group.id
        )
        count_result = await db.execute(count_q)
        new_count = count_result.scalar() or 0
        group.member_count = new_count
        group.is_active = should_activate_group(new_count, group.min_members_to_activate)

    await db.commit()
    return assigned


async def get_user_groups(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> list[Group]:
    """Get all groups that a user belongs to."""
    q = (
        select(Group)
        .join(group_members, group_members.c.group_id == Group.id)
        .where(group_members.c.user_id == user_id)
    )
    result = await db.execute(q)
    return list(result.scalars().all())


async def list_visible_groups(
    db: AsyncSession,
    user: User | None = None,
) -> list[dict]:
    """List all non-hidden groups with membership status for a user.

    Hidden groups only appear if the user is already a member.
    """
    result = await db.execute(select(Group))
    all_groups = list(result.scalars().all())

    # Get user's current group IDs
    user_group_ids: set[str] = set()
    if user:
        member_q = select(group_members.c.group_id).where(
            group_members.c.user_id == user.id
        )
        member_result = await db.execute(member_q)
        user_group_ids = {row[0] for row in member_result}

    groups_out = []
    for group in all_groups:
        is_member = group.id in user_group_ids
        # Hidden groups only visible to members
        if group.is_hidden and not is_member:
            continue
        groups_out.append(await build_group_payload(db, group, viewer=user, is_member=is_member))

    return groups_out


async def join_group(
    db: AsyncSession,
    user_id: uuid.UUID,
    group_id: str,
) -> Group:
    """Manually join a group."""
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise ValueError("Group not found")

    # Check if already a member
    check = await db.execute(
        select(group_members).where(
            group_members.c.user_id == user_id,
            group_members.c.group_id == group_id,
        )
    )
    if check.first():
        raise ValueError("Already a member")

    await db.execute(
        group_members.insert().values(user_id=user_id, group_id=group_id)
    )

    # Update member count
    count_q = select(func.count()).select_from(group_members).where(
        group_members.c.group_id == group_id
    )
    count_result = await db.execute(count_q)
    group.member_count = count_result.scalar() or 0
    group.is_active = should_activate_group(group.member_count, group.min_members_to_activate)

    await db.commit()
    await db.refresh(group)
    return group


async def leave_group(
    db: AsyncSession,
    user_id: uuid.UUID,
    group_id: str,
) -> Group:
    """Leave a group."""
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise ValueError("Group not found")

    deleted = await db.execute(
        delete(group_members).where(
            group_members.c.user_id == user_id,
            group_members.c.group_id == group_id,
        )
    )
    if deleted.rowcount == 0:
        raise ValueError("Not a member")

    # Update member count
    count_q = select(func.count()).select_from(group_members).where(
        group_members.c.group_id == group_id
    )
    count_result = await db.execute(count_q)
    group.member_count = count_result.scalar() or 0
    group.is_active = should_activate_group(group.member_count, group.min_members_to_activate)

    await db.commit()
    await db.refresh(group)
    return group
