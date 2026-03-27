from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dna_profile import TAG_VECTOR_DIMENSIONS, DnaProfile
from app.models.pick import Pick, PickMode
from app.models.sequencing_session import SequencingSession, SessionStatus
from app.models.user import Gender, SequencingStatus, User
from app.services.auth_utils import create_access_token


def auth_headers(user: User) -> dict[str, str]:
    token = create_access_token(user.id, user.auth_version)
    return {"Authorization": f"Bearer {token}"}


async def create_completed_user(db: AsyncSession, email: str = "dna@test.com") -> User:
    user = User(
        email=email,
        name="DNA Tester",
        gender=Gender.other,
        region="TW",
        sequencing_status=SequencingStatus.completed,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def create_session_with_pick(
    db: AsyncSession,
    user: User,
    *,
    pick_created_at: datetime,
) -> tuple[SequencingSession, Pick]:
    session = SequencingSession(
        user_id=user.id,
        version=1,
        status=SessionStatus.completed,
    )
    db.add(session)
    await db.flush()

    user.active_session_id = session.id

    pick = Pick(
        user_id=user.id,
        session_id=session.id,
        round_number=1,
        phase=1,
        pair_id="p1",
        movie_a_tmdb_id=10,
        movie_b_tmdb_id=20,
        chosen_tmdb_id=10,
        pick_mode=PickMode.watched,
        test_dimension="mindfuck",
        created_at=pick_created_at,
    )
    db.add(pick)
    await db.commit()
    await db.refresh(session)
    await db.refresh(pick)
    return session, pick


async def create_profile(
    db: AsyncSession,
    user: User,
    session: SequencingSession,
    *,
    updated_at: datetime,
) -> DnaProfile:
    profile = DnaProfile(
        user_id=user.id,
        session_id=session.id,
        version=session.version,
        is_active=True,
        archetype_id="dark_poet",
        tag_vector=[0.1] * TAG_VECTOR_DIMENSIONS,
        genre_vector={"Drama": 1.0},
        quadrant_scores={
            "mainstream_independent": 3.0,
            "rational_emotional": 3.0,
            "light_dark": 4.0,
        },
        ticket_style="classic",
        personality_reading="stored reading",
        hidden_traits=["observant"],
        conversation_style="quiet",
        ideal_movie_date="late-night cinema",
        updated_at=updated_at,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


@pytest.mark.asyncio
class TestDnaBuildEndpoint:
    async def test_build_skips_ai_when_profile_is_already_up_to_date(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        now = datetime.now(UTC)
        user = await create_completed_user(db_session, email="existing-dna@test.com")
        session, _pick = await create_session_with_pick(
            db_session,
            user,
            pick_created_at=now - timedelta(minutes=5),
        )
        await create_profile(
            db_session,
            user,
            session,
            updated_at=now,
        )

        with (
            patch("app.routers.dna.generate_personality", new_callable=AsyncMock) as mock_ai,
            patch(
                "app.routers.dna._get_session_picks_and_genres",
                new_callable=AsyncMock,
            ) as mock_get_picks,
        ):
            response = await client.post("/dna/build", headers=auth_headers(user))

        assert response.status_code == 200
        assert response.json() == {
            "status": "ready",
            "message": "DNA profile already up to date",
        }
        mock_ai.assert_not_awaited()
        mock_get_picks.assert_not_awaited()

    async def test_build_recomputes_when_session_has_newer_picks(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        now = datetime.now(UTC)
        user = await create_completed_user(db_session, email="stale-dna@test.com")
        session, _pick = await create_session_with_pick(
            db_session,
            user,
            pick_created_at=now,
        )
        await create_profile(
            db_session,
            user,
            session,
            updated_at=now - timedelta(minutes=5),
        )

        dna_data = {
            "archetype_id": "dark_poet",
            "tag_vector": [0.2] * TAG_VECTOR_DIMENSIONS,
            "tag_labels": {"mindfuck": 1.0},
            "excluded_tags": [],
            "genre_vector": {"Drama": 1.0},
            "quadrant_scores": {
                "mainstream_independent": 3.0,
                "rational_emotional": 3.0,
                "light_dark": 4.5,
            },
            "ticket_style": "classic",
        }
        personality = {
            "personality_reading": "fresh reading",
            "hidden_traits": ["precise"],
            "conversation_style": "direct",
            "ideal_movie_date": "matinee",
        }

        with (
            patch(
                "app.routers.dna._get_session_picks_and_genres",
                new_callable=AsyncMock,
                return_value=(
                    [
                        {
                            "round_number": 1,
                            "phase": 1,
                            "pair_id": "p1",
                            "movie_a_tmdb_id": 10,
                            "movie_b_tmdb_id": 20,
                            "chosen_tmdb_id": 10,
                            "pick_mode": "watched",
                            "test_dimension": "mindfuck",
                        }
                    ],
                    {10: ["Drama"]},
                ),
            ) as mock_get_picks,
            patch("app.routers.dna.build_dna", return_value=dna_data) as mock_build_dna,
            patch(
                "app.routers.dna.generate_personality",
                new_callable=AsyncMock,
                return_value=personality,
            ) as mock_ai,
        ):
            response = await client.post("/dna/build", headers=auth_headers(user))

        assert response.status_code == 200
        assert response.json() == {
            "status": "ready",
            "message": "DNA profile built successfully",
        }
        mock_get_picks.assert_awaited_once()
        mock_build_dna.assert_called_once()
        mock_ai.assert_awaited_once()

        result = await db_session.execute(
            select(DnaProfile).where(DnaProfile.session_id == session.id)
        )
        profile = result.scalar_one()
        assert profile.personality_reading == "fresh reading"
        assert profile.hidden_traits == ["precise"]
