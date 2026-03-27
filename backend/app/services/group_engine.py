"""Group engine: auto-assign users to groups based on DNA tag affinity."""

import json
import logging
import uuid
from collections import defaultdict
from pathlib import Path

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.group import Group, group_members
from app.models.group_message import GroupMessage
from app.models.theater_list import TheaterList, TheaterListReply
from app.models.user import User
from app.services.r2_storage import normalize_public_object_url
from app.services.tmdb_client import get_movies

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


async def _hydrate_group_movies_with_posters(movie_rows: list[dict]) -> list[dict]:
    """Attach poster_url to group-level movie payloads from TMDB metadata."""
    tmdb_ids = sorted({
        int(movie["tmdb_id"])
        for movie in movie_rows
        if int(movie.get("tmdb_id", 0)) > 0
    })
    if not tmdb_ids:
        return movie_rows

    movies_by_id = await get_movies(tmdb_ids)
    hydrated: list[dict] = []
    for movie in movie_rows:
        detailed = movies_by_id.get(int(movie["tmdb_id"]))
        hydrated.append({
            **movie,
            "poster_url": detailed.poster_url if detailed else None,
        })
    return hydrated


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


async def _recent_activity(
    db: AsyncSession,
    group_id: str,
    limit: int = 6,
) -> list[dict]:
    list_result = await db.execute(
        select(TheaterList, User)
        .join(User, User.id == TheaterList.creator_id)
        .where(
            TheaterList.group_id == group_id,
            TheaterList.visibility == "group",
        )
        .order_by(TheaterList.created_at.desc())
        .limit(limit)
    )
    list_rows = list_result.all()
    activity: list[dict] = [
        {
            "id": f"list-{theater_list.id}",
            "type": "list_created",
            "created_at": theater_list.created_at.isoformat(),
            "actor": {
                "id": str(author.id),
                "name": author.name,
                "avatar_url": normalize_public_object_url(author.avatar_url),
            },
            "list_id": str(theater_list.id),
            "list_title": theater_list.title,
            "body": theater_list.description,
        }
        for theater_list, author in list_rows
    ]

    reply_result = await db.execute(
        select(TheaterListReply, User, TheaterList)
        .join(User, User.id == TheaterListReply.user_id)
        .join(TheaterList, TheaterList.id == TheaterListReply.list_id)
        .where(
            TheaterList.group_id == group_id,
            TheaterList.visibility == "group",
        )
        .order_by(TheaterListReply.created_at.desc())
        .limit(limit)
    )
    reply_rows = reply_result.all()
    activity.extend(
        {
            "id": f"reply-{reply.id}",
            "type": "list_replied",
            "created_at": reply.created_at.isoformat(),
            "actor": {
                "id": str(author.id),
                "name": author.name,
                "avatar_url": normalize_public_object_url(author.avatar_url),
            },
            "list_id": str(theater_list.id),
            "list_title": theater_list.title,
            "body": reply.body,
        }
        for reply, author, theater_list in reply_rows
    )

    activity.sort(key=lambda item: item["created_at"], reverse=True)
    return activity[:limit]


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

    recommended_movies = recommend_movies_for_group(group.primary_tags or [], tag_vector)
    shared_watchlist = build_shared_watchlist(group.primary_tags or [], member_vectors)
    hydrated_movies = await _hydrate_group_movies_with_posters(
        [*recommended_movies, *shared_watchlist]
    )
    poster_by_tmdb_id = {
        int(movie["tmdb_id"]): movie.get("poster_url")
        for movie in hydrated_movies
    }

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
        "recent_activity": await _recent_activity(db, group.id),
        "recommended_movies": [
            {
                **movie,
                "poster_url": poster_by_tmdb_id.get(int(movie["tmdb_id"])),
            }
            for movie in recommended_movies
        ],
        "shared_watchlist": [
            {
                **movie,
                "poster_url": poster_by_tmdb_id.get(int(movie["tmdb_id"])),
            }
            for movie in shared_watchlist
        ],
    }


async def _build_group_payloads_for_groups(
    db: AsyncSession,
    groups: list[Group],
    *,
    viewer: User | None = None,
    user_group_ids: set[str] | None = None,
) -> list[dict]:
    """Serialize many groups with shared batched queries for list endpoints."""
    if not groups:
        return []

    group_ids = [group.id for group in groups]
    memberships = user_group_ids or set()
    profile = viewer.dna_profile if viewer else None
    tag_vector = list(profile.tag_vector) if profile and profile.tag_vector is not None else []

    members_result = await db.execute(
        select(group_members.c.group_id, User)
        .join(User, group_members.c.user_id == User.id)
        .where(group_members.c.group_id.in_(group_ids))
        .order_by(group_members.c.group_id.asc(), User.name.asc())
    )
    members_by_group: dict[str, list[User]] = defaultdict(list)
    for group_id, member in members_result.all():
        members_by_group[group_id].append(member)

    messages_result = await db.execute(
        select(GroupMessage, User)
        .join(User, User.id == GroupMessage.user_id)
        .where(GroupMessage.group_id.in_(group_ids))
        .order_by(GroupMessage.group_id.asc(), GroupMessage.created_at.desc())
    )
    messages_by_group: dict[str, list[dict]] = defaultdict(list)
    viewer_id = viewer.id if viewer else None
    for message, author in messages_result.all():
        group_messages = messages_by_group[message.group_id]
        if len(group_messages) >= 8:
            continue
        group_messages.append(
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
        )

    list_result = await db.execute(
        select(TheaterList, User)
        .join(User, User.id == TheaterList.creator_id)
        .where(
            TheaterList.group_id.in_(group_ids),
            TheaterList.visibility == "group",
        )
        .order_by(TheaterList.group_id.asc(), TheaterList.created_at.desc())
    )
    activity_by_group: dict[str, list[dict]] = defaultdict(list)
    for theater_list, author in list_result.all():
        activity_by_group[theater_list.group_id].append(
            {
                "id": f"list-{theater_list.id}",
                "type": "list_created",
                "created_at": theater_list.created_at.isoformat(),
                "actor": {
                    "id": str(author.id),
                    "name": author.name,
                    "avatar_url": normalize_public_object_url(author.avatar_url),
                },
                "list_id": str(theater_list.id),
                "list_title": theater_list.title,
                "body": theater_list.description,
            }
        )

    reply_result = await db.execute(
        select(TheaterListReply, User, TheaterList)
        .join(User, User.id == TheaterListReply.user_id)
        .join(TheaterList, TheaterList.id == TheaterListReply.list_id)
        .where(
            TheaterList.group_id.in_(group_ids),
            TheaterList.visibility == "group",
        )
        .order_by(TheaterList.group_id.asc(), TheaterListReply.created_at.desc())
    )
    for reply, author, theater_list in reply_result.all():
        activity_by_group[theater_list.group_id].append(
            {
                "id": f"reply-{reply.id}",
                "type": "list_replied",
                "created_at": reply.created_at.isoformat(),
                "actor": {
                    "id": str(author.id),
                    "name": author.name,
                    "avatar_url": normalize_public_object_url(author.avatar_url),
                },
                "list_id": str(theater_list.id),
                "list_title": theater_list.title,
                "body": reply.body,
            }
        )

    group_movie_payloads: dict[str, tuple[list[dict], list[dict]]] = {}
    all_group_movies: list[dict] = []
    for group in groups:
        members = members_by_group.get(group.id, [])
        member_vectors = [
            list(member.dna_profile.tag_vector)
            for member in members
            if member.dna_profile and member.dna_profile.tag_vector is not None
        ]
        recommended_movies = recommend_movies_for_group(
            group.primary_tags or [],
            tag_vector,
        )
        shared_watchlist = build_shared_watchlist(
            group.primary_tags or [],
            member_vectors,
        )
        group_movie_payloads[group.id] = (recommended_movies, shared_watchlist)
        all_group_movies.extend(recommended_movies)
        all_group_movies.extend(shared_watchlist)

    hydrated_movies = await _hydrate_group_movies_with_posters(all_group_movies)
    poster_by_tmdb_id = {
        int(movie["tmdb_id"]): movie.get("poster_url")
        for movie in hydrated_movies
    }

    payloads = []
    for group in groups:
        recommended_movies, shared_watchlist = group_movie_payloads[group.id]
        members = members_by_group.get(group.id, [])
        recent_messages = list(reversed(messages_by_group.get(group.id, [])))
        recent_activity = sorted(
            activity_by_group.get(group.id, []),
            key=lambda item: item["created_at"],
            reverse=True,
        )[:6]
        payloads.append(
            {
                "id": group.id,
                "name": group.name,
                "subtitle": group.subtitle,
                "icon": group.icon,
                "primary_tags": group.primary_tags or [],
                "is_hidden": group.is_hidden,
                "member_count": group.member_count,
                "is_active": group.is_active,
                "is_member": group.id in memberships,
                "shared_tags": get_shared_tags(tag_vector, group.primary_tags or []),
                "member_preview": [
                    {
                        "id": str(member.id),
                        "name": member.name,
                        "avatar_url": normalize_public_object_url(member.avatar_url),
                    }
                    for member in members[:6]
                ],
                "recent_messages": recent_messages,
                "recent_activity": recent_activity,
                "recommended_movies": [
                    {
                        **movie,
                        "poster_url": poster_by_tmdb_id.get(int(movie["tmdb_id"])),
                    }
                    for movie in recommended_movies
                ],
                "shared_watchlist": [
                    {
                        **movie,
                        "poster_url": poster_by_tmdb_id.get(int(movie["tmdb_id"])),
                    }
                    for movie in shared_watchlist
                ],
            }
        )

    return payloads


async def auto_assign_groups(
    db: AsyncSession,
    user: User,
) -> list[Group]:
    """Auto-assign user to groups based on their DNA tag_vector affinity.

    This is intentionally additive: it adds newly matched groups without
    stripping existing memberships, so manual joins are preserved.
    Returns the user's full current group set after assignment.
    """
    profile = user.dna_profile
    if not profile or profile.tag_vector is None:
        return []

    tag_vector = list(profile.tag_vector)

    # Fetch all groups
    result = await db.execute(select(Group))
    all_groups = list(result.scalars().all())

    existing_group_ids = {
        group.id
        for group in await get_user_groups(db, user.id)
    }

    for group in all_groups:
        affinity = compute_group_affinity(tag_vector, group.primary_tags or [])
        if affinity >= AUTO_ASSIGN_THRESHOLD and group.id not in existing_group_ids:
            await db.execute(
                group_members.insert().values(user_id=user.id, group_id=group.id)
            )
            existing_group_ids.add(group.id)

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
    return [group for group in all_groups if group.id in existing_group_ids]


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

    visible_groups = []
    for group in all_groups:
        is_member = group.id in user_group_ids
        # Hidden groups only visible to members
        if group.is_hidden and not is_member:
            continue
        visible_groups.append(group)

    return await _build_group_payloads_for_groups(
        db,
        visible_groups,
        viewer=user,
        user_group_ids=user_group_ids,
    )


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
