"""Sequencing router: pair retrieval, pick submission, progress tracking."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
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
    RetestResponse,
    SeedMovieRequest,
    SkipRequest,
)
from app.services.ai_pair_engine import get_ai_pair
from app.services.pair_engine import compute_quadrant_from_picks, get_pair_for_round
from app.services.session_service import (
    can_extend,
    complete_base,
    complete_extension,
    get_or_create_session,
    start_extension,
    start_retest,
)
from app.services.tmdb_client import get_movie, search_movies

router = APIRouter()


def _get_phase(round_number: int) -> int:
    """Phase 1: rounds 1-5, Phase 2: 6-12, Phase 3: 13+ (includes extensions)."""
    if round_number <= 5:
        return 1
    if round_number <= 12:
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
        phase=_get_phase(min(next_round, session.total_rounds)),
        total_rounds=session.total_rounds,
        completed=completed,
        seed_movie_tmdb_id=session.seed_movie_tmdb_id,
        can_extend=can_extend(session) and completed,
        extension_batches=session.extension_batches,
        max_extension_batches=session.max_extension_batches,
        session_version=session.version,
        is_extending=is_extending,
    )


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
    return [
        MovieSearchResult(
            tmdb_id=m.tmdb_id,
            title_en=m.title_en,
            title_zh=m.title_zh,
            poster_url=m.poster_url,
            year=m.year,
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
    phase = _get_phase(round_number)

    if round_number > session.total_rounds:
        return PairResponse(
            round_number=round_number,
            phase=3,
            movie_a=MovieInfo(tmdb_id=0, title_en="", title_zh=""),
            movie_b=MovieInfo(tmdb_id=0, title_en="", title_zh=""),
            completed=True,
        )

    if phase == 1:
        seed_genres: list[str] = []
        if session.seed_movie_tmdb_id:
            seed_movie = await get_movie(session.seed_movie_tmdb_id)
            if seed_movie:
                seed_genres = seed_movie.genres

        pair = get_pair_for_round(round_number, seed_genres)
        movie_a = await get_movie(pair["movie_a"]["tmdb_id"])
        movie_b = await get_movie(pair["movie_b"]["tmdb_id"])

        if not movie_a or not movie_b:
            raise HTTPException(status_code=502, detail="Failed to fetch movie data from TMDB")

        return PairResponse(
            round_number=round_number,
            phase=phase,
            movie_a=await _movie_to_info(movie_a),
            movie_b=await _movie_to_info(movie_b),
            test_dimension=pair.get("dimension"),
        )

    else:
        quadrant = compute_quadrant_from_picks(picks)
        result = await get_ai_pair(phase, round_number, picks, quadrant)

        if not result:
            raise HTTPException(status_code=502, detail="Failed to generate movie pair")

        return PairResponse(
            round_number=round_number,
            phase=phase,
            movie_a=await _movie_to_info(result["movie_a"]),
            movie_b=await _movie_to_info(result["movie_b"]),
            test_dimension=result.get("test_dimension"),
        )


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

    phase = _get_phase(round_number)

    # Determine pair info based on phase
    if phase == 1:
        seed_genres: list[str] = []
        if session.seed_movie_tmdb_id:
            seed_movie = await get_movie(session.seed_movie_tmdb_id)
            if seed_movie:
                seed_genres = seed_movie.genres
        pair = get_pair_for_round(round_number, seed_genres)
        pair_id = pair["id"]
        movie_a_tmdb_id = pair["movie_a"]["tmdb_id"]
        movie_b_tmdb_id = pair["movie_b"]["tmdb_id"]
        test_dimension = pair.get("dimension")
    else:
        pair_id = None
        movie_a_tmdb_id = body.chosen_tmdb_id
        movie_b_tmdb_id = 0
        test_dimension = body.test_dimension

    if phase == 1 and body.chosen_tmdb_id not in (movie_a_tmdb_id, movie_b_tmdb_id):
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

    phase = _get_phase(round_number)

    if phase == 1:
        seed_genres: list[str] = []
        if session.seed_movie_tmdb_id:
            seed_movie = await get_movie(session.seed_movie_tmdb_id)
            if seed_movie:
                seed_genres = seed_movie.genres
        pair = get_pair_for_round(round_number, seed_genres)
        pair_id = pair["id"]
        movie_a_tmdb_id = pair["movie_a"]["tmdb_id"]
        movie_b_tmdb_id = pair["movie_b"]["tmdb_id"]
    else:
        pair_id = None
        movie_a_tmdb_id = 0
        movie_b_tmdb_id = 0

    # Determine test_dimension
    if phase == 1:
        skip_dimension = pair.get("dimension")
    else:
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

    if round_number >= session.total_rounds:
        if session.status == SessionStatus.extending:
            await complete_extension(db, session)
        else:
            await complete_base(db, session)
        user.sequencing_status = SequencingStatus.completed

    await db.commit()
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
    """Unlock 5 more rounds after base sequencing is completed."""
    session = await get_or_create_session(db, user.id)

    try:
        session = await start_extension(db, session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

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

    user.active_session_id = new_session.id
    user.sequencing_status = SequencingStatus.not_started
    user.seed_movie_tmdb_id = None
    await db.commit()

    return RetestResponse(version=new_session.version)
