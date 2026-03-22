"""Celery tasks for async DNA build and matching trigger."""

import asyncio
import logging
import uuid

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine from sync Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _build_dna_for_user(user_id: str):
    """Build DNA profile and trigger matching for a user."""
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    from sqlalchemy.orm import sessionmaker

    from app.config import settings
    from app.models.dna_profile import DnaProfile
    from app.models.pick import Pick
    from app.models.user import SequencingStatus, User
    from app.services.ai_personality import generate_personality
    from app.services.dna_builder import build_dna
    from app.services.session_service import get_or_create_session
    from app.services.tmdb_client import get_movie

    engine = create_async_engine(settings.database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Fetch user
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user or user.sequencing_status != SequencingStatus.completed:
            logger.warning("User %s not ready for DNA build", user_id)
            return

        session = await get_or_create_session(db, user.id)

        # Fetch picks
        result = await db.execute(
            select(Pick).where(Pick.session_id == session.id).order_by(Pick.round_number)
        )
        picks_orm = result.scalars().all()
        picks = [
            {
                "round_number": p.round_number,
                "phase": p.phase,
                "pair_id": p.pair_id,
                "movie_a_tmdb_id": p.movie_a_tmdb_id,
                "movie_b_tmdb_id": p.movie_b_tmdb_id,
                "chosen_tmdb_id": p.chosen_tmdb_id,
                "pick_mode": p.pick_mode.value if p.pick_mode else None,
                "test_dimension": p.test_dimension,
            }
            for p in picks_orm
        ]

        # Build genre map from TMDB
        tmdb_ids = {p["chosen_tmdb_id"] for p in picks if p["chosen_tmdb_id"]}
        genre_map = {}
        for tmdb_id in tmdb_ids:
            movie = await get_movie(tmdb_id)
            if movie:
                genre_map[tmdb_id] = movie.genres

        dna_data = build_dna(picks, genre_map)

        # Generate AI personality
        personality = await generate_personality(
            picks=picks,
            tag_labels=dna_data["tag_labels"],
            excluded_tags=dna_data["excluded_tags"],
            genre_vector=dna_data["genre_vector"],
            quadrant_scores=dna_data["quadrant_scores"],
            archetype_id=dna_data["archetype_id"],
        )

        # Create or update DNA profile
        existing = await db.execute(
            select(DnaProfile).where(DnaProfile.session_id == session.id)
        )
        profile = existing.scalar_one_or_none()

        if profile:
            profile.archetype_id = dna_data["archetype_id"]
            profile.tag_vector = dna_data["tag_vector"]
            profile.genre_vector = dna_data["genre_vector"]
            profile.quadrant_scores = dna_data["quadrant_scores"]
            profile.ticket_style = dna_data["ticket_style"]
            profile.personality_reading = personality["personality_reading"] if personality else None
            profile.hidden_traits = personality["hidden_traits"] if personality else []
            profile.conversation_style = personality["conversation_style"] if personality else None
            profile.ideal_movie_date = personality["ideal_movie_date"] if personality else None
        else:
            profile = DnaProfile(
                user_id=user.id,
                session_id=session.id,
                version=session.version,
                is_active=True,
                archetype_id=dna_data["archetype_id"],
                tag_vector=dna_data["tag_vector"],
                genre_vector=dna_data["genre_vector"],
                quadrant_scores=dna_data["quadrant_scores"],
                ticket_style=dna_data["ticket_style"],
                personality_reading=personality["personality_reading"] if personality else None,
                hidden_traits=personality["hidden_traits"] if personality else [],
                conversation_style=personality["conversation_style"] if personality else None,
                ideal_movie_date=personality["ideal_movie_date"] if personality else None,
            )
            db.add(profile)

        await db.commit()
        logger.info("DNA build completed for user %s", user_id)

    await engine.dispose()


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def build_dna_task(self, user_id: str):
    """Build DNA profile asynchronously and trigger matching."""
    try:
        _run_async(_build_dna_for_user(user_id))
        # Trigger matching after DNA build
        from app.tasks.match_tasks import find_matches_task
        find_matches_task.delay(user_id)
    except Exception as exc:
        logger.exception("DNA build task failed for user %s", user_id)
        raise self.retry(exc=exc)
