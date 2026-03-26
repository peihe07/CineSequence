"""One-time script: generate personal tickets for existing users with completed DNA profiles.

Usage:
    cd backend
    source .venv/bin/activate
    python scripts/backfill_personal_tickets.py
    python scripts/backfill_personal_tickets.py --force

Set DATABASE_URL env var to target production DB, or it uses local .env defaults.
"""

import asyncio
import json
import logging
import sys
from pathlib import Path

# Add backend to path so app imports work
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

_data_dir = Path(__file__).parent.parent / "app" / "data"
_taxonomy = json.loads((_data_dir / "tag_taxonomy.json").read_text())
TAG_KEYS = list(_taxonomy["tags"].keys())


async def main(force: bool = False):
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    from sqlalchemy.orm import sessionmaker

    from app.config import settings
    from app.models.dna_profile import DnaProfile
    from app.models.user import SequencingStatus, User
    from app.models.user_favorite_movie import UserFavoriteMovie
    from app.services.matcher import get_archetype_display_name
    from app.services.ticket_gen import generate_and_upload_personal_ticket

    engine = create_async_engine(settings.database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Find all active DNA profiles that need a personal ticket.
        query = (
            select(DnaProfile)
            .join(User, User.id == DnaProfile.user_id)
            .where(DnaProfile.is_active == True)  # noqa: E712
            .where(User.sequencing_status == SequencingStatus.completed)
        )
        if not force:
            query = query.where(DnaProfile.personal_ticket_url.is_(None))

        result = await db.execute(query)
        profiles = list(result.scalars().all())

        if not profiles:
            if force:
                logger.info("No completed active profiles found to regenerate. All done!")
            else:
                logger.info("No profiles need backfilling. All done!")
            return

        if force:
            logger.info("Force-regenerating %d personal tickets", len(profiles))
        else:
            logger.info("Found %d profiles to backfill", len(profiles))

        success = 0
        failed = 0

        for profile in profiles:
            # Load user
            user_result = await db.execute(
                select(User).where(User.id == profile.user_id)
            )
            user = user_result.scalar_one_or_none()
            if not user:
                logger.warning("User %s not found, skipping", profile.user_id)
                failed += 1
                continue

            # Build archetype display name
            archetype_display = get_archetype_display_name(profile.archetype_id)

            # Extract top tags
            tag_vec = list(profile.tag_vector) if profile.tag_vector else []
            top_tag_indices = sorted(range(len(tag_vec)), key=lambda i: tag_vec[i], reverse=True)
            top_tags = [
                TAG_KEYS[i]
                for i in top_tag_indices[:8]
                if i < len(TAG_KEYS) and tag_vec[i] >= 0.3
            ]

            # Extract top genres
            genre_vector = profile.genre_vector or {}
            sorted_genres = sorted(genre_vector.items(), key=lambda x: x[1], reverse=True)
            top_genres = [g for g, score in sorted_genres[:5] if score >= 0.1]
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
                success += 1
                logger.info(
                    "[%d/%d] %s (%s) → %s",
                    success + failed,
                    len(profiles),
                    user.name,
                    user.email,
                    ticket_url,
                )
            except Exception:
                await db.rollback()
                failed += 1
                logger.exception(
                    "Failed to generate ticket for user %s (%s)",
                    user.name,
                    user.email,
                )

        logger.info("Done! %d succeeded, %d failed out of %d total", success, failed, len(profiles))

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main(force="--force" in sys.argv[1:]))
