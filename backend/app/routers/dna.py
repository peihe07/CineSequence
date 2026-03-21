"""DNA router: build DNA profile and retrieve results."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.dna_profile import DnaProfile
from app.models.pick import Pick
from app.models.user import SequencingStatus, User
from app.schemas.dna import (
    ArchetypeInfo,
    DnaBuildResponse,
    DnaHistorySummary,
    DnaResultResponse,
    QuadrantScores,
)
from app.services.ai_personality import generate_personality
from app.services.dna_builder import ARCHETYPES, build_dna, get_tag_labels
from app.services.session_service import can_extend, get_or_create_session
from app.services.tmdb_client import get_movie

router = APIRouter()


def _get_archetype_info(archetype_id: str) -> ArchetypeInfo:
    """Lookup archetype from seed data."""
    for a in ARCHETYPES:
        if a["id"] == archetype_id:
            return ArchetypeInfo(
                id=a["id"], name=a["name"], name_en=a["name_en"],
                icon=a["icon"], description=a["description"],
            )
    a = ARCHETYPES[0]
    return ArchetypeInfo(
        id=a["id"], name=a["name"], name_en=a["name_en"],
        icon=a["icon"], description=a["description"],
    )


async def _get_session_picks_and_genres(
    db: AsyncSession, session_id,
) -> tuple[list[dict], dict[int, list[str]]]:
    """Fetch all picks for a session and build genre map from TMDB."""
    result = await db.execute(
        select(Pick).where(Pick.session_id == session_id).order_by(Pick.round_number)
    )
    picks_orm = result.scalars().all()

    picks = []
    tmdb_ids = set()
    for p in picks_orm:
        picks.append({
            "round_number": p.round_number,
            "phase": p.phase,
            "pair_id": p.pair_id,
            "movie_a_tmdb_id": p.movie_a_tmdb_id,
            "movie_b_tmdb_id": p.movie_b_tmdb_id,
            "chosen_tmdb_id": p.chosen_tmdb_id,
            "pick_mode": p.pick_mode.value if p.pick_mode else None,
            "test_dimension": p.test_dimension,
        })
        if p.chosen_tmdb_id:
            tmdb_ids.add(p.chosen_tmdb_id)

    genre_map: dict[int, list[str]] = {}
    for tmdb_id in tmdb_ids:
        movie = await get_movie(tmdb_id)
        if movie:
            genre_map[tmdb_id] = movie.genres

    return picks, genre_map


@router.post("/build", response_model=DnaBuildResponse)
async def build_dna_profile(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Build DNA profile from completed sequencing picks."""
    if user.sequencing_status != SequencingStatus.completed:
        raise HTTPException(status_code=400, detail="Sequencing not completed yet")

    session = await get_or_create_session(db, user.id)
    picks, genre_map = await _get_session_picks_and_genres(db, session.id)
    dna_data = build_dna(picks, genre_map)

    # Generate AI personality reading
    personality = await generate_personality(
        picks=picks,
        tag_labels=dna_data["tag_labels"],
        excluded_tags=dna_data["excluded_tags"],
        genre_vector=dna_data["genre_vector"],
        quadrant_scores=dna_data["quadrant_scores"],
        archetype_id=dna_data["archetype_id"],
    )

    # Check if DNA already exists for this session (extension re-compute)
    existing = await db.execute(
        select(DnaProfile).where(DnaProfile.session_id == session.id)
    )
    profile = existing.scalar_one_or_none()

    if profile:
        # Update existing profile (extension re-computation)
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
        # Create new profile
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
    return DnaBuildResponse(status="ready", message="DNA profile built successfully")


@router.get("/result", response_model=DnaResultResponse)
async def get_dna_result(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    version: Annotated[int | None, Query()] = None,
):
    """Get the user's DNA result. Optionally specify version for history."""
    if version:
        result = await db.execute(
            select(DnaProfile).where(
                DnaProfile.user_id == user.id,
                DnaProfile.version == version,
            )
        )
    else:
        result = await db.execute(
            select(DnaProfile).where(
                DnaProfile.user_id == user.id,
                DnaProfile.is_active == True,  # noqa: E712
            )
        )

    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="DNA profile not found. Build it first.")

    session = await get_or_create_session(db, user.id)
    archetype_info = _get_archetype_info(profile.archetype_id)
    tag_vector = list(profile.tag_vector) if profile.tag_vector else []
    tag_labels = get_tag_labels(tag_vector)

    return DnaResultResponse(
        archetype=archetype_info,
        tag_vector=tag_vector,
        tag_labels=tag_labels,
        genre_vector=profile.genre_vector or {},
        quadrant_scores=QuadrantScores(**(profile.quadrant_scores or {})),
        personality_reading=profile.personality_reading,
        hidden_traits=profile.hidden_traits or [],
        conversation_style=profile.conversation_style,
        ideal_movie_date=profile.ideal_movie_date,
        ticket_style=profile.ticket_style,
        version=profile.version,
        can_extend=can_extend(session),
    )


@router.get("/history")
async def get_dna_history(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get all DNA profile versions for comparison."""
    result = await db.execute(
        select(DnaProfile)
        .where(DnaProfile.user_id == user.id)
        .order_by(DnaProfile.version.desc())
    )
    profiles = result.scalars().all()

    return [
        DnaHistorySummary(
            version=p.version,
            archetype=_get_archetype_info(p.archetype_id),
            ticket_style=p.ticket_style,
            created_at=p.created_at.isoformat(),
        )
        for p in profiles
    ]
