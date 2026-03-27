"""Shared helpers for backfilling missing personal ticket images."""

import json
import logging
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dna_profile import DnaProfile
from app.models.user import SequencingStatus, User
from app.models.user_favorite_movie import UserFavoriteMovie
from app.services.matcher import get_archetype_display_name
from app.services.ticket_gen import generate_and_upload_personal_ticket

logger = logging.getLogger(__name__)

_data_dir = Path(__file__).parent.parent / "data"
_taxonomy = json.loads((_data_dir / "tag_taxonomy.json").read_text())
TAG_KEYS = list(_taxonomy["tags"].keys())


@dataclass(slots=True)
class TicketBackfillResult:
    processed: int = 0
    success: int = 0
    failed: int = 0


async def backfill_personal_tickets(
    db: AsyncSession,
    *,
    force: bool = False,
    limit: int | None = None,
) -> TicketBackfillResult:
    """Generate missing personal tickets for active completed profiles.

    When `force` is false, only profiles with a missing `personal_ticket_url` are processed.
    """
    query = (
        select(DnaProfile)
        .join(User, User.id == DnaProfile.user_id)
        .where(DnaProfile.is_active.is_(True))
        .where(User.sequencing_status == SequencingStatus.completed)
        .order_by(DnaProfile.created_at.asc())
    )
    if not force:
        query = query.where(DnaProfile.personal_ticket_url.is_(None))
    if limit is not None:
        query = query.limit(limit)

    result = await db.execute(query)
    profiles = list(result.scalars().all())

    summary = TicketBackfillResult(processed=len(profiles))
    if not profiles:
        return summary

    for profile in profiles:
        user_result = await db.execute(select(User).where(User.id == profile.user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            summary.failed += 1
            logger.warning("User %s not found while backfilling personal ticket", profile.user_id)
            continue

        archetype_display = get_archetype_display_name(profile.archetype_id)

        tag_vec = list(profile.tag_vector) if profile.tag_vector is not None else []
        top_tag_indices = sorted(range(len(tag_vec)), key=lambda idx: tag_vec[idx], reverse=True)
        top_tags = [
            TAG_KEYS[idx]
            for idx in top_tag_indices[:8]
            if idx < len(TAG_KEYS) and tag_vec[idx] >= 0.3
        ]

        genre_vector = profile.genre_vector or {}
        top_genres = [
            genre
            for genre, score in sorted(genre_vector.items(), key=lambda item: item[1], reverse=True)[:5]
            if score >= 0.1
        ]

        favorites_result = await db.execute(
            select(UserFavoriteMovie)
            .where(UserFavoriteMovie.user_id == user.id)
            .order_by(UserFavoriteMovie.display_order)
        )
        favorite_movies = [
            favorite.title_zh or favorite.title_en
            for favorite in favorites_result.scalars().all()
            if favorite.title_zh or favorite.title_en
        ]

        try:
            ticket_url = await generate_and_upload_personal_ticket(
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
            profile.personal_ticket_url = ticket_url
            await db.commit()
            summary.success += 1
            logger.info(
                "[%d/%d] Backfilled personal ticket for %s (%s)",
                summary.success + summary.failed,
                summary.processed,
                user.name,
                user.email,
            )
        except Exception:
            await db.rollback()
            summary.failed += 1
            logger.exception(
                "Failed to generate ticket for user %s (%s)",
                user.name,
                user.email,
            )

    return summary
