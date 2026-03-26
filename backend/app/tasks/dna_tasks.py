"""Celery tasks for async DNA build and matching trigger."""

import logging
import uuid

from app.tasks.async_utils import run_async, task_session
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def build_dna_for_user(user_id: str):
    """Build DNA profile and trigger matching for a user."""
    import json as _json
    from pathlib import Path as _Path

    from sqlalchemy import select

    from app.models.dna_profile import DnaProfile
    from app.models.pick import Pick
    from app.models.user import SequencingStatus, User
    from app.models.user_favorite_movie import UserFavoriteMovie
    from app.services.ai_personality import generate_personality
    from app.services.dna_builder import build_dna
    from app.services.session_service import get_or_create_session
    from app.services.tmdb_client import get_movie

    async with task_session() as db:
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
        tmdb_ids = set()
        for pick in picks:
            tmdb_ids.add(pick["movie_a_tmdb_id"])
            if pick["movie_b_tmdb_id"]:
                tmdb_ids.add(pick["movie_b_tmdb_id"])
            if pick["chosen_tmdb_id"]:
                tmdb_ids.add(pick["chosen_tmdb_id"])
        genre_map = {}
        movie_map = {}
        for tmdb_id in tmdb_ids:
            movie = await get_movie(tmdb_id)
            if movie:
                movie_map[tmdb_id] = movie
                genre_map[tmdb_id] = movie.genres

        for pick in picks:
            movie_a = movie_map.get(pick["movie_a_tmdb_id"])
            movie_b = movie_map.get(pick["movie_b_tmdb_id"])
            chosen = movie_map.get(pick["chosen_tmdb_id"])
            pick["movie_a_title"] = (movie_a.title_zh or movie_a.title_en) if movie_a else None
            pick["movie_b_title"] = (movie_b.title_zh or movie_b.title_en) if movie_b else None
            pick["chosen_title"] = (chosen.title_zh or chosen.title_en) if chosen else None

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
            profile.personality_reading = (
                personality["personality_reading"] if personality else None
            )
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
        await db.refresh(profile)
        logger.info("DNA build completed for user %s", user_id)

        # Generate personal ticket image
        from app.services.matcher import get_archetype_display_name
        from app.services.ticket_gen import generate_and_upload_personal_ticket

        archetype_display = get_archetype_display_name(profile.archetype_id)

        # Extract top tags from tag_vector
        _tax_path = _Path(__file__).parent.parent / "data" / "tag_taxonomy.json"
        _tax = _json.loads(_tax_path.read_text())
        tag_keys = list(_tax["tags"].keys())
        tag_vec = list(profile.tag_vector) if profile.tag_vector else []
        top_tag_indices = sorted(range(len(tag_vec)), key=lambda i: tag_vec[i], reverse=True)
        top_tags = [
            tag_keys[i]
            for i in top_tag_indices[:8]
            if i < len(tag_keys) and tag_vec[i] >= 0.3
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
            logger.info("Personal ticket generated for user %s: %s", user_id, ticket_url)
        except Exception:
            logger.exception("Failed to generate personal ticket for user %s", user_id)

        # Notify user that DNA is ready
        from app.services.notification_service import (
            emit_notification_safely,
            notify_dna_ready,
        )
        await emit_notification_safely(
            notify_dna_ready,
            db,
            user.id,
            dna_data["archetype_id"],
            context=f"dna_ready user={user.id}",
        )


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def build_dna_task(self, user_id: str):
    """Build DNA profile asynchronously and trigger matching."""
    try:
        run_async(build_dna_for_user(user_id))
        # Trigger matching after DNA build
        from app.tasks.match_tasks import find_matches_task
        find_matches_task.delay(user_id)
    except Exception as exc:
        logger.exception("DNA build task failed for user %s", user_id)
        raise self.retry(exc=exc)
