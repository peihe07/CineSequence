"""Sequencing router: pair retrieval, pick submission, progress tracking."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.pick import Pick
from app.models.sequencing_session import SessionStatus
from app.models.user import SequencingStatus, User
from app.schemas.sequencing import (
    ExtendResponse,
    MovieInfo,
    MovieSearchResult,
    PairResponse,
    PickRequest,
    ProgressResponse,
    RerollRequest,
    RetestResponse,
    SeedMovieRequest,
    SkipRequest,
)
from app.services.ai_pair_engine import get_ai_pair
from app.services.pair_engine import (
    compute_quadrant_from_picks,
    get_pair_for_round,
    get_phase1_pairs,
    get_reroll_pair_for_round,
)
from app.services.session_service import (
    can_extend,
    complete_base,
    complete_extension,
    get_or_create_session,
    start_extension,
    start_retest,
)
from app.services.tmdb_client import get_movie, get_movies, search_movies

router = APIRouter()
logger = logging.getLogger(__name__)


async def _enqueue_dna_build(user_id) -> None:
    """Trigger DNA generation after sequencing completion.

    Prefer Celery for normal operation, but fall back to an in-process build if the
    broker/result backend is unavailable so sequencing completion never 500s.
    """
    from app.tasks.dna_tasks import build_dna_for_user, build_dna_task
    from app.tasks.match_tasks import find_matches_task

    try:
        build_dna_task.delay(str(user_id))
    except Exception:
        logger.exception(
            "Failed to enqueue DNA build for user %s; falling back to in-process build",
            user_id,
        )
        await build_dna_for_user(str(user_id))
        try:
            find_matches_task.delay(str(user_id))
        except Exception:
            logger.exception(
                "Failed to enqueue match build after inline DNA build "
                "for user %s",
                user_id,
            )


def _get_phase(round_number: int, base_rounds: int = 30) -> int:
    """Compute phase from round number and session's base_rounds.

    Phase boundaries scale proportionally with base_rounds:
    - Phase 1: ~23% of base (rule-based quadrant pairs)
    - Phase 2: ~37% of base (AI adaptive exploration)
    - Phase 3: remaining ~40% (soul tags + convergence verification)

    base_rounds=20 → P1: 1-5, P2: 6-12, P3: 13+
    base_rounds=30 → P1: 1-7, P2: 8-18, P3: 19+
    """
    p1_end = max(3, round(base_rounds * 0.23))
    p2_end = max(p1_end + 2, round(base_rounds * 0.6))
    if round_number <= p1_end:
        return 1
    if round_number <= p2_end:
        return 2
    return 3


async def _get_session_picks(db: AsyncSession, session_id) -> list[dict]:
    """Fetch all picks for a session as dicts."""
    result = await db.execute(
        select(Pick).where(Pick.session_id == session_id).order_by(Pick.round_number)
    )
    picks = result.scalars().all()
    return [
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
        for p in picks
    ]


async def _movie_to_info(movie) -> MovieInfo:
    """Convert tmdb_client.MovieInfo to schema MovieInfo."""
    return MovieInfo(
        tmdb_id=movie.tmdb_id,
        title_en=movie.title_en,
        title_zh=movie.title_zh,
        poster_url=movie.poster_url,
        year=movie.year,
        genres=movie.genres,
        overview=movie.overview,
    )


def _build_progress(session, pick_count: int) -> ProgressResponse:
    """Build ProgressResponse from session state."""
    next_round = pick_count + 1
    completed = next_round > session.total_rounds
    is_extending = session.status == SessionStatus.extending

    return ProgressResponse(
        round_number=next_round,
        phase=_get_phase(min(next_round, session.total_rounds), session.base_rounds),
        total_rounds=session.total_rounds,
        completed=completed,
        seed_movie_tmdb_id=session.seed_movie_tmdb_id,
        can_extend=can_extend(session) and completed,
        extension_batches=session.extension_batches,
        max_extension_batches=session.max_extension_batches,
        session_version=session.version,
        is_extending=is_extending,
    )


def _merge_tmdb_ids(*groups: list[int] | set[int] | None) -> list[int]:
    merged: set[int] = set()
    for group in groups:
        if not group:
            continue
        merged.update(tmdb_id for tmdb_id in group if tmdb_id)
    return list(merged)


def _serialize_pair_payload(
    round_number: int,
    phase: int,
    movie_a_tmdb_id: int,
    movie_b_tmdb_id: int,
    test_dimension: str | None = None,
    pair_id: str | None = None,
) -> dict:
    return {
        "round_number": round_number,
        "phase": phase,
        "movie_a_tmdb_id": movie_a_tmdb_id,
        "movie_b_tmdb_id": movie_b_tmdb_id,
        "test_dimension": test_dimension,
        "pair_id": pair_id,
    }


def _get_pending_pair_payload(session, round_number: int) -> dict | None:
    payload = session.pending_pair_payload
    if not payload:
        return None
    if session.pending_pair_round_number != round_number:
        return None
    if payload.get("round_number") != round_number:
        return None
    return payload


async def _pair_response_from_payload(payload: dict) -> PairResponse:
    movie_a = await get_movie(payload["movie_a_tmdb_id"])
    movie_b = await get_movie(payload["movie_b_tmdb_id"])
    if not movie_a or not movie_b:
        raise HTTPException(status_code=502, detail="Failed to fetch movie data from TMDB")

    return PairResponse(
        round_number=payload["round_number"],
        phase=payload["phase"],
        movie_a=await _movie_to_info(movie_a),
        movie_b=await _movie_to_info(movie_b),
        test_dimension=payload.get("test_dimension"),
    )


def _clear_pending_pair(session) -> None:
    session.pending_pair_round_number = None
    session.pending_pair_payload = None


@router.post("/seed-movie")
async def set_seed_movie(
    body: SeedMovieRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Set the user's seed movie before sequencing starts."""
    movie = await get_movie(body.tmdb_id)
    if not movie:
        raise HTTPException(status_code=400, detail="Movie not found on TMDB")

    session = await get_or_create_session(db, user.id)
    session.seed_movie_tmdb_id = body.tmdb_id
    _clear_pending_pair(session)

    # Keep user-level fields in sync for backwards compatibility
    user.seed_movie_tmdb_id = body.tmdb_id
    user.active_session_id = session.id
    if user.sequencing_status == SequencingStatus.not_started:
        user.sequencing_status = SequencingStatus.in_progress

    await db.commit()
    return {"tmdb_id": body.tmdb_id, "title": movie.title_zh or movie.title_en}


@router.get("/search")
async def search_tmdb_movies(
    q: Annotated[str, Query(min_length=1, max_length=100)],
    _user: Annotated[User, Depends(get_current_user)],
):
    """Search TMDB movies for seed movie autocomplete."""
    results = await search_movies(q)
    detailed_movies = await get_movies([movie.tmdb_id for movie in results])
    return [
        MovieSearchResult(
            tmdb_id=m.tmdb_id,
            title_en=m.title_en,
            title_zh=m.title_zh,
            poster_url=m.poster_url,
            year=m.year,
            genres=detailed_movies[m.tmdb_id].genres if m.tmdb_id in detailed_movies else m.genres,
            runtime_minutes=(
                detailed_movies[m.tmdb_id].runtime_minutes
                if m.tmdb_id in detailed_movies
                else m.runtime_minutes
            ),
        )
        for m in results
    ]


@router.get("/pair", response_model=PairResponse)
async def get_pair(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get the next movie pair for the current round."""
    session = await get_or_create_session(db, user.id)
    picks = await _get_session_picks(db, session.id)
    round_number = len(picks) + 1
    phase = _get_phase(round_number, session.base_rounds)

    if round_number > session.total_rounds:
        return PairResponse(
            round_number=round_number,
            phase=3,
            movie_a=MovieInfo(tmdb_id=0, title_en="", title_zh=""),
            movie_b=MovieInfo(tmdb_id=0, title_en="", title_zh=""),
            completed=True,
        )

    pending_payload = _get_pending_pair_payload(session, round_number)
    if pending_payload:
        return await _pair_response_from_payload(pending_payload)

    if phase == 1:
        seed_genres: list[str] = []
        if session.seed_movie_tmdb_id:
            seed_movie = await get_movie(session.seed_movie_tmdb_id)
            if seed_movie:
                seed_genres = seed_movie.genres

        pair = get_pair_for_round(round_number, seed_genres, session_seed=str(session.id))
        session.pending_pair_round_number = round_number
        session.pending_pair_payload = _serialize_pair_payload(
            round_number=round_number,
            phase=phase,
            movie_a_tmdb_id=pair["movie_a"]["tmdb_id"],
            movie_b_tmdb_id=pair["movie_b"]["tmdb_id"],
            test_dimension=pair.get("dimension"),
            pair_id=pair["id"],
        )
        await db.commit()
        return await _pair_response_from_payload(session.pending_pair_payload)

    else:
        quadrant = compute_quadrant_from_picks(picks)
        result = await get_ai_pair(
            phase,
            round_number,
            picks,
            quadrant,
            extra_excluded_tmdb_ids=session.reroll_excluded_tmdb_ids,
            session_seed=str(session.id),
        )

        if not result:
            raise HTTPException(status_code=502, detail="Failed to generate movie pair")

        session.pending_pair_round_number = round_number
        session.pending_pair_payload = _serialize_pair_payload(
            round_number=round_number,
            phase=phase,
            movie_a_tmdb_id=result["movie_a"].tmdb_id,
            movie_b_tmdb_id=result["movie_b"].tmdb_id,
            test_dimension=result.get("test_dimension"),
        )
        await db.commit()
        return await _pair_response_from_payload(session.pending_pair_payload)


@router.post("/reroll", response_model=PairResponse)
async def reroll_pair(
    body: RerollRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Replace the current pair without consuming the round."""
    session = await get_or_create_session(db, user.id)
    picks = await _get_session_picks(db, session.id)
    round_number = len(picks) + 1
    phase = _get_phase(round_number, session.base_rounds)

    if round_number > session.total_rounds:
        raise HTTPException(status_code=400, detail="Sequencing already completed")

    exclude_tmdb_ids = set(body.exclude_tmdb_ids)

    if phase == 1:
        seed_genres: list[str] = []
        if session.seed_movie_tmdb_id:
            seed_movie = await get_movie(session.seed_movie_tmdb_id)
            if seed_movie:
                seed_genres = seed_movie.genres

        used_pair_ids = {pick["pair_id"] for pick in picks if pick.get("pair_id")}
        used_tmdb_ids = {
            tmdb_id
            for pick in picks
            for tmdb_id in (pick.get("movie_a_tmdb_id"), pick.get("movie_b_tmdb_id"))
            if tmdb_id
        }
        scheduled_pairs = get_phase1_pairs(seed_genres, session_seed=str(session.id))
        reserved_tmdb_ids = {
            tmdb_id
            for index, scheduled_pair in enumerate(scheduled_pairs, start=1)
            if index != round_number
            for tmdb_id in (
                scheduled_pair["movie_a"]["tmdb_id"],
                scheduled_pair["movie_b"]["tmdb_id"],
            )
        } | used_tmdb_ids
        pair = get_reroll_pair_for_round(
            round_number,
            seed_genres,
            used_pair_ids=used_pair_ids,
            exclude_tmdb_ids=exclude_tmdb_ids,
            reserved_tmdb_ids=reserved_tmdb_ids,
        )
        if not pair:
            raise HTTPException(status_code=409, detail="No alternate pair available")
        session.pending_pair_round_number = round_number
        session.pending_pair_payload = _serialize_pair_payload(
            round_number=round_number,
            phase=phase,
            movie_a_tmdb_id=pair["movie_a"]["tmdb_id"],
            movie_b_tmdb_id=pair["movie_b"]["tmdb_id"],
            test_dimension=pair.get("dimension"),
            pair_id=pair["id"],
        )
        await db.commit()
        return await _pair_response_from_payload(session.pending_pair_payload)

    session.reroll_excluded_tmdb_ids = _merge_tmdb_ids(
        session.reroll_excluded_tmdb_ids,
        exclude_tmdb_ids,
    )
    quadrant = compute_quadrant_from_picks(picks)
    result = await get_ai_pair(
        phase,
        round_number,
        picks,
        quadrant,
        extra_excluded_tmdb_ids=_merge_tmdb_ids(
            session.reroll_excluded_tmdb_ids,
            exclude_tmdb_ids,
        ),
        session_seed=str(session.id),
    )

    if not result:
        raise HTTPException(status_code=502, detail="Failed to generate alternate movie pair")

    session.pending_pair_round_number = round_number
    session.pending_pair_payload = _serialize_pair_payload(
        round_number=round_number,
        phase=phase,
        movie_a_tmdb_id=result["movie_a"].tmdb_id,
        movie_b_tmdb_id=result["movie_b"].tmdb_id,
        test_dimension=result.get("test_dimension"),
    )
    await db.commit()

    return await _pair_response_from_payload(session.pending_pair_payload)


@router.post("/pick", response_model=ProgressResponse)
async def submit_pick(
    body: PickRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Submit a movie choice for the current round."""
    session = await get_or_create_session(db, user.id)
    picks = await _get_session_picks(db, session.id)
    round_number = len(picks) + 1

    if round_number > session.total_rounds:
        raise HTTPException(status_code=400, detail="Sequencing already completed")

    phase = _get_phase(round_number, session.base_rounds)
    pending_payload = _get_pending_pair_payload(session, round_number)

    # Determine pair info based on phase
    if pending_payload:
        pair_id = pending_payload.get("pair_id")
        movie_a_tmdb_id = pending_payload["movie_a_tmdb_id"]
        movie_b_tmdb_id = pending_payload["movie_b_tmdb_id"]
        test_dimension = pending_payload.get("test_dimension")
    elif phase == 1:
        seed_genres: list[str] = []
        if session.seed_movie_tmdb_id:
            seed_movie = await get_movie(session.seed_movie_tmdb_id)
            if seed_movie:
                seed_genres = seed_movie.genres
        pair = get_pair_for_round(round_number, seed_genres, session_seed=str(session.id))
        pair_id = pair["id"]
        movie_a_tmdb_id = pair["movie_a"]["tmdb_id"]
        movie_b_tmdb_id = pair["movie_b"]["tmdb_id"]
        test_dimension = pair.get("dimension")
    else:
        if body.movie_a_tmdb_id is None or body.movie_b_tmdb_id is None:
            raise HTTPException(status_code=400, detail="Phase 2-3 picks require full pair context")
        pair_id = None
        movie_a_tmdb_id = body.movie_a_tmdb_id
        movie_b_tmdb_id = body.movie_b_tmdb_id
        test_dimension = body.test_dimension

    if body.chosen_tmdb_id not in (movie_a_tmdb_id, movie_b_tmdb_id):
        raise HTTPException(status_code=400, detail="Chosen movie is not in the current pair")

    pick = Pick(
        user_id=user.id,
        session_id=session.id,
        round_number=round_number,
        phase=phase,
        pair_id=pair_id,
        movie_a_tmdb_id=movie_a_tmdb_id,
        movie_b_tmdb_id=movie_b_tmdb_id,
        chosen_tmdb_id=body.chosen_tmdb_id,
        pick_mode=body.pick_mode,
        test_dimension=test_dimension,
        response_time_ms=body.response_time_ms,
    )
    db.add(pick)
    _clear_pending_pair(session)

    # Update session status based on completion
    if round_number >= session.total_rounds:
        if session.status == SessionStatus.extending:
            await complete_extension(db, session)
        else:
            await complete_base(db, session)
        user.sequencing_status = SequencingStatus.completed
    elif user.sequencing_status == SequencingStatus.not_started:
        user.sequencing_status = SequencingStatus.in_progress

    await db.commit()
    if round_number >= session.total_rounds:
        await _enqueue_dna_build(user.id)
    return _build_progress(session, len(picks) + 1)


@router.post("/skip", response_model=ProgressResponse)
async def skip_pair(
    body: SkipRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Skip the current pair (neither movie chosen)."""
    session = await get_or_create_session(db, user.id)
    picks = await _get_session_picks(db, session.id)
    round_number = len(picks) + 1

    if round_number > session.total_rounds:
        raise HTTPException(status_code=400, detail="Sequencing already completed")

    phase = _get_phase(round_number, session.base_rounds)
    pending_payload = _get_pending_pair_payload(session, round_number)

    if pending_payload:
        pair_id = pending_payload.get("pair_id")
        movie_a_tmdb_id = pending_payload["movie_a_tmdb_id"]
        movie_b_tmdb_id = pending_payload["movie_b_tmdb_id"]
        skip_dimension = pending_payload.get("test_dimension")
    elif phase == 1:
        seed_genres: list[str] = []
        if session.seed_movie_tmdb_id:
            seed_movie = await get_movie(session.seed_movie_tmdb_id)
            if seed_movie:
                seed_genres = seed_movie.genres
        pair = get_pair_for_round(round_number, seed_genres, session_seed=str(session.id))
        pair_id = pair["id"]
        movie_a_tmdb_id = pair["movie_a"]["tmdb_id"]
        movie_b_tmdb_id = pair["movie_b"]["tmdb_id"]
        skip_dimension = pair.get("dimension")
    else:
        if body.movie_a_tmdb_id is None or body.movie_b_tmdb_id is None:
            raise HTTPException(status_code=400, detail="Phase 2-3 skips require full pair context")
        pair_id = None
        movie_a_tmdb_id = body.movie_a_tmdb_id
        movie_b_tmdb_id = body.movie_b_tmdb_id
        skip_dimension = body.test_dimension

    pick = Pick(
        user_id=user.id,
        session_id=session.id,
        round_number=round_number,
        phase=phase,
        pair_id=pair_id,
        movie_a_tmdb_id=movie_a_tmdb_id,
        movie_b_tmdb_id=movie_b_tmdb_id,
        chosen_tmdb_id=None,
        pick_mode=None,
        test_dimension=skip_dimension,
        response_time_ms=body.response_time_ms,
    )
    db.add(pick)
    _clear_pending_pair(session)

    if round_number >= session.total_rounds:
        if session.status == SessionStatus.extending:
            await complete_extension(db, session)
        else:
            await complete_base(db, session)
        user.sequencing_status = SequencingStatus.completed

    await db.commit()
    if round_number >= session.total_rounds:
        await _enqueue_dna_build(user.id)
    return _build_progress(session, len(picks) + 1)


@router.get("/progress", response_model=ProgressResponse)
async def get_progress(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get the user's current sequencing progress."""
    session = await get_or_create_session(db, user.id)
    result = await db.execute(
        select(func.count()).select_from(Pick).where(Pick.session_id == session.id)
    )
    pick_count = result.scalar() or 0
    return _build_progress(session, pick_count)


@router.post("/extend", response_model=ExtendResponse)
async def extend_sequencing(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Unlock more rounds after base sequencing is completed."""
    session = await get_or_create_session(db, user.id)

    try:
        session = await start_extension(db, session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    _clear_pending_pair(session)
    # Flush session changes first to avoid circular FK dependency with User
    await db.flush()

    # Reset user status to in_progress for the extension
    user.sequencing_status = SequencingStatus.in_progress
    await db.commit()

    return ExtendResponse(
        total_rounds=session.total_rounds,
        extension_batches=session.extension_batches,
        max_extension_batches=session.max_extension_batches,
    )


@router.post("/retest", response_model=RetestResponse)
async def retest_sequencing(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Start a fresh sequencing session, preserving old DNA."""
    new_session = await start_retest(db, user.id)
    # Flush session changes first to avoid circular FK dependency with User
    await db.flush()

    user.active_session_id = new_session.id
    user.sequencing_status = SequencingStatus.not_started
    user.seed_movie_tmdb_id = None
    await db.commit()

    return RetestResponse(version=new_session.version)
