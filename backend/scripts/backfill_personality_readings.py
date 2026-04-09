"""Rebuild AI personality readings for existing active DNA profiles.

Usage:
    cd backend
    source .venv/bin/activate
    python scripts/backfill_personality_readings.py
    python scripts/backfill_personality_readings.py --apply
    python scripts/backfill_personality_readings.py --apply --user-id <uuid>

Dry-run mode (default): prints what would change without writing to DB.
Add --apply to persist changes. By default, personal tickets are regenerated too
when applying so the refreshed reading stays in sync with ticket assets.
"""

import argparse
import asyncio
import logging
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Persist regenerated readings")
    parser.add_argument("--user-id", type=str, help="Only rebuild a single user's active profile")
    parser.add_argument("--limit", type=int, help="Only process the first N matched profiles")
    parser.add_argument(
        "--skip-ticket",
        action="store_true",
        help="Do not regenerate personal tickets while applying",
    )
    return parser.parse_args()


async def main() -> None:
    args = _parse_args()

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    from sqlalchemy.orm import sessionmaker

    from app.config import settings
    from app.models.dna_profile import DnaProfile
    from app.models.user import SequencingStatus, User
    from app.routers.dna import _get_session_picks_and_genres
    from app.routers.profile import _generate_personal_ticket_url
    from app.services.ai_personality import generate_personality
    from app.services.dna_builder import build_comparison_evidence, build_dna, get_top_tags

    target_user_id = uuid.UUID(args.user_id) if args.user_id else None

    engine = create_async_engine(settings.database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        query = (
            select(DnaProfile, User)
            .join(User, User.id == DnaProfile.user_id)
            .where(
                DnaProfile.is_active == True,  # noqa: E712
                User.sequencing_status == SequencingStatus.completed,
            )
            .order_by(DnaProfile.updated_at.desc())
        )
        if target_user_id:
            query = query.where(DnaProfile.user_id == target_user_id)
        if args.limit:
            query = query.limit(args.limit)

        rows = (await db.execute(query)).all()
        if not rows:
            logger.info("No active completed DNA profiles found.")
            await engine.dispose()
            return

        logger.info("Found %d active DNA profiles to rebuild", len(rows))

        changed = 0
        unchanged = 0
        failed = 0

        for profile, user in rows:
            if profile.session_id is None:
                logger.warning("Skipping user %s: profile has no session_id", user.id)
                failed += 1
                continue

            try:
                picks, genre_map = await _get_session_picks_and_genres(db, profile.session_id)
                if not picks:
                    logger.warning("Skipping user %s: no picks found for session %s", user.id, profile.session_id)
                    failed += 1
                    continue

                dna_data = build_dna(picks, genre_map)
                top_tags = dna_data.get("top_tags") or get_top_tags(dna_data["tag_vector"])
                personality = await generate_personality(
                    picks=picks,
                    tag_labels=dna_data["tag_labels"],
                    top_tags=top_tags,
                    excluded_tags=dna_data["excluded_tags"],
                    tag_confidence=dna_data["tag_confidence"],
                    tag_consistency=dna_data["tag_consistency"],
                    genre_vector=dna_data["genre_vector"],
                    quadrant_scores=dna_data["quadrant_scores"],
                    archetype_id=dna_data["archetype_id"],
                    comparison_evidence=build_comparison_evidence(picks, top_tags),
                )
                if personality is None:
                    logger.warning("Skipping user %s: personality generation returned no result", user.id)
                    failed += 1
                    continue

                reading_changed = profile.personality_reading != personality["personality_reading"]
                traits_changed = (profile.hidden_traits or []) != personality["hidden_traits"]
                style_changed = profile.conversation_style != personality["conversation_style"]
                date_changed = profile.ideal_movie_date != personality["ideal_movie_date"]

                if not any((reading_changed, traits_changed, style_changed, date_changed)):
                    unchanged += 1
                    logger.info("  [UNCHANGED] user=%s", user.id)
                    continue

                changed += 1
                logger.info(
                    "  [CHANGE] user=%s reading=%s traits=%s style=%s date=%s",
                    user.id,
                    reading_changed,
                    traits_changed,
                    style_changed,
                    date_changed,
                )

                if not args.apply:
                    continue

                profile.personality_reading = personality["personality_reading"]
                profile.hidden_traits = personality["hidden_traits"]
                profile.conversation_style = personality["conversation_style"]
                profile.ideal_movie_date = personality["ideal_movie_date"]

                if not args.skip_ticket:
                    profile.personal_ticket_url = await _generate_personal_ticket_url(db, user, profile)

                await db.commit()
            except Exception:
                await db.rollback()
                failed += 1
                logger.exception("Failed rebuilding personality reading for user %s", user.id)

        if args.apply:
            logger.info(
                "Applied personality rebuild: %d changed, %d unchanged, %d failed",
                changed, unchanged, failed,
            )
        else:
            logger.info(
                "DRY RUN: %d would change, %d unchanged, %d failed. Run with --apply to persist.",
                changed, unchanged, failed,
            )

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
