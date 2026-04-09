"""DNA router: build DNA profile and retrieve results."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.dna_profile import DnaProfile
from app.models.pick import Pick
from app.models.user import SequencingStatus, User
from app.schemas.dna import (
    ArchetypeInfo,
    CharacterMatchResponse,
    ComparisonEvidence,
    DnaBuildResponse,
    DnaHistorySummary,
    DnaResultResponse,
    InteractionDiagnostics,
    QuadrantScores,
    SignalDetail,
)
from app.services.ai_personality import generate_personality
from app.services.character_mirror import find_resonant_characters, generate_mirror_readings
from app.services.dna_builder import (
    ARCHETYPES,
    build_comparison_evidence,
    build_dna,
    compute_confidence,
    compute_consistency,
    get_tag_labels,
    get_top_tags,
)
from app.services.session_service import can_extend, get_or_create_session
from app.services.tmdb_client import get_movie, get_movies

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
            "decision_type": p.decision_type.value,
            "test_dimension": p.test_dimension,
        })
        tmdb_ids.add(p.movie_a_tmdb_id)
        if p.movie_b_tmdb_id:
            tmdb_ids.add(p.movie_b_tmdb_id)
        if p.chosen_tmdb_id:
            tmdb_ids.add(p.chosen_tmdb_id)

    genre_map: dict[int, list[str]] = {}
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

    return picks, genre_map


def _build_signal_details(
    tag_labels: dict[str, float],
    top_tags: list[str],
    tag_confidence: dict[str, float],
    tag_consistency: dict[str, float],
) -> tuple[list[SignalDetail], list[SignalDetail], list[SignalDetail]]:
    supporting = [
        SignalDetail(
            tag=tag,
            score=round(float(tag_labels.get(tag, 0.0)), 3),
            confidence=round(float(tag_confidence.get(tag, 0.0)), 3),
            consistency=round(float(tag_consistency.get(tag, 0.5)), 3),
        )
        for tag in top_tags[:3]
    ]

    avoided = [
        SignalDetail(
            tag=tag,
            score=round(float(tag_labels.get(tag, 0.0)), 3) if tag in tag_labels else None,
            confidence=round(float(tag_confidence.get(tag, 0.0)), 3),
            consistency=round(float(ratio), 3),
        )
        for tag, ratio in sorted(
            (
                (tag, ratio)
                for tag, ratio in tag_consistency.items()
                if ratio <= 0.34
            ),
            key=lambda item: (tag_confidence.get(item[0], 0.0), 1 - item[1]),
            reverse=True,
        )[:3]
    ]

    mixed = [
        SignalDetail(
            tag=tag,
            score=round(float(tag_labels.get(tag, 0.0)), 3) if tag in tag_labels else None,
            confidence=round(float(tag_confidence.get(tag, 0.0)), 3),
            consistency=round(float(ratio), 3),
        )
        for tag, ratio in sorted(
            (
                (tag, ratio)
                for tag, ratio in tag_consistency.items()
                if 0.35 <= ratio <= 0.65 and tag_confidence.get(tag, 0.0) >= 0.67
            ),
            key=lambda item: tag_confidence.get(item[0], 0.0),
            reverse=True,
        )[:3]
    ]

    return supporting, avoided, mixed


def _build_interaction_diagnostics(picks: list[dict]) -> InteractionDiagnostics:
    skip_count = 0
    dislike_both_count = 0
    explicit_pick_count = 0

    for pick in picks:
        decision_type = pick.get("decision_type", "pick")
        if decision_type == "skip":
            skip_count += 1
        elif decision_type == "dislike_both":
            dislike_both_count += 1
        elif pick.get("chosen_tmdb_id") is not None:
            explicit_pick_count += 1

    return InteractionDiagnostics(
        skip_count=skip_count,
        dislike_both_count=dislike_both_count,
        explicit_pick_count=explicit_pick_count,
    )


@router.post("/build", response_model=DnaBuildResponse)
async def build_dna_profile(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    force: Annotated[bool, Query()] = False,
):
    """Build DNA profile from completed sequencing picks."""
    if user.sequencing_status != SequencingStatus.completed:
        raise HTTPException(status_code=400, detail="Sequencing not completed yet")

    session = await get_or_create_session(db, user.id)

    existing_result = await db.execute(
        select(DnaProfile).where(DnaProfile.session_id == session.id)
    )
    existing_profile = existing_result.scalar_one_or_none()
    latest_pick_at = await db.scalar(
        select(func.max(Pick.created_at)).where(Pick.session_id == session.id)
    )

    if (
        not force
        and existing_profile
        and existing_profile.updated_at is not None
        and (latest_pick_at is None or latest_pick_at <= existing_profile.updated_at)
    ):
        return DnaBuildResponse(status="ready", message="DNA profile already up to date")

    picks, genre_map = await _get_session_picks_and_genres(db, session.id)
    dna_data = build_dna(picks, genre_map)
    top_tags = dna_data.get("top_tags") or get_top_tags(dna_data["tag_vector"])

    # Generate AI personality reading
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

    # Check if DNA already exists for this session (extension re-compute)
    profile = existing_profile

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
    tag_vector = list(profile.tag_vector) if profile.tag_vector is not None else []
    tag_labels = get_tag_labels(tag_vector)
    top_tags = get_top_tags(tag_vector)
    picks, _genre_map = await _get_session_picks_and_genres(db, session.id)
    tag_confidence = compute_confidence(picks)
    tag_consistency = compute_consistency(picks)
    supporting_signals, avoided_signals, mixed_signals = _build_signal_details(
        tag_labels,
        top_tags,
        tag_confidence,
        tag_consistency,
    )
    comparison_evidence = [
        ComparisonEvidence(**item)
        for item in build_comparison_evidence(picks, top_tags)
    ]
    interaction_diagnostics = _build_interaction_diagnostics(picks)

    return DnaResultResponse(
        archetype=archetype_info,
        tag_vector=tag_vector,
        tag_labels=tag_labels,
        top_tags=top_tags,
        supporting_signals=supporting_signals,
        avoided_signals=avoided_signals,
        mixed_signals=mixed_signals,
        comparison_evidence=comparison_evidence,
        interaction_diagnostics=interaction_diagnostics,
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


@router.get("/mirror", response_model=list[CharacterMatchResponse])
async def get_character_mirror(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return top 3 resonant characters for the user's active DNA profile."""
    result = await db.execute(
        select(DnaProfile).where(
            DnaProfile.user_id == user.id,
            DnaProfile.is_active == True,  # noqa: E712
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="DNA profile not found.")

    tag_vector = list(profile.tag_vector) if profile.tag_vector is not None else []
    top_tags = get_top_tags(tag_vector)

    characters = find_resonant_characters(profile)
    characters = await generate_mirror_readings(profile, characters, top_tags)
    movies_by_id = await get_movies([c.tmdb_id for c in characters if c.tmdb_id])

    return [
        CharacterMatchResponse(
            id=c.id,
            name=c.name,
            movie=c.movie,
            movie_zh=movies_by_id.get(c.tmdb_id).title_zh if movies_by_id.get(c.tmdb_id) else None,
            tmdb_id=c.tmdb_id,
            score=c.score,
            psych_labels=c.psych_labels,
            psych_framework=c.psych_framework,
            one_liner=c.one_liner,
            mirror_reading=c.mirror_reading,
        )
        for c in characters
    ]


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
