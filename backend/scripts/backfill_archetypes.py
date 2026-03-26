"""Re-assign archetypes for existing DNA profiles using IDF-weighted scoring.

Usage:
    cd backend
    source .venv/bin/activate
    python scripts/backfill_archetypes.py

Dry-run mode (default): prints changes without writing to DB.
Add --apply to commit changes.

Set DATABASE_URL env var to target production DB, or it uses local .env defaults.
"""

import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


async def main():
    apply = "--apply" in sys.argv

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    from sqlalchemy.orm import sessionmaker

    from app.config import settings
    from app.models.dna_profile import DnaProfile
    from app.models.user import User
    from app.services.dna_builder import assign_archetype

    engine = create_async_engine(settings.database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        result = await db.execute(
            select(DnaProfile)
            .join(User, User.id == DnaProfile.user_id)
            .where(DnaProfile.is_active == True)  # noqa: E712
        )
        profiles = list(result.scalars().all())

        if not profiles:
            logger.info("No active DNA profiles found.")
            return

        logger.info("Found %d active profiles to re-evaluate", len(profiles))

        changed = 0
        unchanged = 0

        for profile in profiles:
            tag_vector = list(profile.tag_vector) if profile.tag_vector else [0.0] * 30
            genre_vector = profile.genre_vector or {}

            new_archetype = assign_archetype(tag_vector, genre_vector)
            new_id = new_archetype["id"]
            new_style = new_archetype["ticket_style"]
            old_id = profile.archetype_id

            if new_id != old_id:
                changed += 1
                logger.info(
                    "  [CHANGE] user=%s: %s → %s",
                    profile.user_id, old_id, new_id,
                )
                if apply:
                    profile.archetype_id = new_id
                    profile.ticket_style = new_style
            else:
                unchanged += 1

        if apply:
            await db.commit()
            logger.info("Committed %d changes (%d unchanged)", changed, unchanged)
        else:
            logger.info(
                "DRY RUN: %d would change, %d unchanged. "
                "Run with --apply to commit.",
                changed, unchanged,
            )

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
