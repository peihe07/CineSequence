"""Tests for sequencing router: integration tests for the pick/skip/progress flow."""

from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.pick import Pick
from app.models.sequencing_session import SequencingSession
from app.models.user import SequencingStatus, User
from app.services.auth_utils import create_access_token
from app.services.tmdb_client import MovieInfo


# Fake TMDB movie for mocking
def _fake_movie(tmdb_id: int = 155, title: str = "Test Movie") -> MovieInfo:
    return MovieInfo(
        tmdb_id=tmdb_id,
        title_en=title,
        title_zh=f"{title}_zh",
        poster_url="https://image.tmdb.org/t/p/w500/test.jpg",
        year=2020,
        genres=["Drama"],
        overview="A test movie",
    )


@pytest_asyncio.fixture
async def auth_user(db_session):
    """Create a test user and return (user, auth_headers)."""
    user = User(
        email="test@example.com",
        name="Test User",
        gender="other",
        region="TW",
        sequencing_status=SequencingStatus.not_started,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = create_access_token(user.id, user.auth_version)
    headers = {"Authorization": f"Bearer {token}"}
    return user, headers


class TestProgress:
    """GET /sequencing/progress"""

    @pytest.mark.asyncio
    async def test_initial_progress(self, client, auth_user):
        _, headers = auth_user
        response = await client.get("/sequencing/progress", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["round_number"] == 1
        assert data["phase"] == 1
        assert data["completed"] is False

    @pytest.mark.asyncio
    async def test_unauthenticated(self, client):
        response = await client.get("/sequencing/progress")
        assert response.status_code == 401


class TestSeedMovie:
    """POST /sequencing/seed-movie"""

    @pytest.mark.asyncio
    @patch("app.routers.sequencing.get_movie", new_callable=AsyncMock)
    async def test_set_seed_movie(self, mock_get_movie, client, auth_user):
        mock_get_movie.return_value = _fake_movie(550, "Fight Club")
        _, headers = auth_user

        response = await client.post(
            "/sequencing/seed-movie",
            json={"tmdb_id": 550},
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["tmdb_id"] == 550

    @pytest.mark.asyncio
    @patch("app.routers.sequencing.get_movie", new_callable=AsyncMock)
    async def test_invalid_movie(self, mock_get_movie, client, auth_user):
        mock_get_movie.return_value = None
        _, headers = auth_user

        response = await client.post(
            "/sequencing/seed-movie",
            json={"tmdb_id": 999999},
            headers=headers,
        )
        assert response.status_code == 400


class TestSearch:
    """GET /sequencing/search"""

    @pytest.mark.asyncio
    @patch("app.routers.sequencing.search_movies", new_callable=AsyncMock)
    async def test_search_returns_results(self, mock_search, client, auth_user):
        mock_search.return_value = [_fake_movie(155, "The Dark Knight")]
        _, headers = auth_user

        response = await client.get(
            "/sequencing/search?q=dark",
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["tmdb_id"] == 155

    @pytest.mark.asyncio
    async def test_search_empty_query(self, client, auth_user):
        _, headers = auth_user
        response = await client.get("/sequencing/search?q=", headers=headers)
        assert response.status_code == 422  # Validation error: min_length=1


class TestPair:
    """GET /sequencing/pair"""

    @pytest.mark.asyncio
    @patch("app.routers.sequencing.get_movie", new_callable=AsyncMock)
    async def test_get_first_pair(self, mock_get_movie, client, auth_user):
        mock_get_movie.return_value = _fake_movie()
        _, headers = auth_user

        response = await client.get("/sequencing/pair", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["round_number"] == 1
        assert data["phase"] == 1
        assert "movie_a" in data
        assert "movie_b" in data
        assert data["completed"] is False

    @pytest.mark.asyncio
    @patch("app.routers.sequencing.get_movie", new_callable=AsyncMock)
    async def test_reroll_returns_different_phase1_pair_without_advancing_round(
        self, mock_get_movie, client, auth_user, db_session
    ):
        async def fake_get_movie(tmdb_id: int):
          return _fake_movie(tmdb_id, f"Movie {tmdb_id}")

        mock_get_movie.side_effect = fake_get_movie
        user, headers = auth_user

        first = await client.get("/sequencing/pair", headers=headers)
        assert first.status_code == 200
        first_data = first.json()

        reroll = await client.post(
            "/sequencing/reroll",
            json={
                "exclude_tmdb_ids": [
                    first_data["movie_a"]["tmdb_id"],
                    first_data["movie_b"]["tmdb_id"],
                ],
            },
            headers=headers,
        )
        assert reroll.status_code == 200
        reroll_data = reroll.json()
        assert reroll_data["round_number"] == 1
        assert reroll_data["phase"] == 1
        assert {
            reroll_data["movie_a"]["tmdb_id"],
            reroll_data["movie_b"]["tmdb_id"],
        } != {
            first_data["movie_a"]["tmdb_id"],
            first_data["movie_b"]["tmdb_id"],
        }

        result = await db_session.execute(select(Pick).where(Pick.user_id == user.id))
        assert result.scalars().all() == []

    @pytest.mark.asyncio
    @patch("app.routers.sequencing.get_movie", new_callable=AsyncMock)
    @patch("app.routers.sequencing.get_ai_pair", new_callable=AsyncMock)
    async def test_phase2_pair_excludes_reroll_history(
        self, mock_get_ai_pair, mock_get_movie, client, auth_user, db_session
    ):
        mock_get_movie.side_effect = lambda tmdb_id: _fake_movie(tmdb_id, f"Movie {tmdb_id}")
        user, headers = auth_user

        await client.get("/sequencing/progress", headers=headers)
        session_result = await db_session.execute(
            select(SequencingSession).where(SequencingSession.user_id == user.id)
        )
        session = session_result.scalar_one()
        session.reroll_excluded_tmdb_ids = [4101, 4102]

        for round_number in range(1, 6):
            db_session.add(Pick(
                user_id=user.id,
                session_id=session.id,
                round_number=round_number,
                phase=1,
                pair_id=f"p1_0{round_number}",
                movie_a_tmdb_id=1000 + round_number,
                movie_b_tmdb_id=2000 + round_number,
                chosen_tmdb_id=1000 + round_number,
                pick_mode="watched",
                test_dimension="mainstream_vs_independent",
            ))
        await db_session.commit()

        mock_get_ai_pair.return_value = {
            "movie_a": _fake_movie(5101, "Movie 5101"),
            "movie_b": _fake_movie(5102, "Movie 5102"),
            "test_dimension": "mindfuck",
        }

        response = await client.get("/sequencing/pair", headers=headers)
        assert response.status_code == 200
        mock_get_ai_pair.assert_awaited_once()
        assert mock_get_ai_pair.await_args.kwargs["extra_excluded_tmdb_ids"] == [4101, 4102]

    @pytest.mark.asyncio
    @patch("app.routers.sequencing.get_movie", new_callable=AsyncMock)
    @patch("app.routers.sequencing.get_ai_pair", new_callable=AsyncMock)
    async def test_phase2_pair_is_reused_within_same_round(
        self, mock_get_ai_pair, mock_get_movie, client, auth_user, db_session
    ):
        mock_get_movie.side_effect = lambda tmdb_id: _fake_movie(tmdb_id, f"Movie {tmdb_id}")
        user, headers = auth_user

        await client.get("/sequencing/progress", headers=headers)
        session_result = await db_session.execute(
            select(SequencingSession).where(SequencingSession.user_id == user.id)
        )
        session = session_result.scalar_one()

        for round_number in range(1, 6):
            db_session.add(Pick(
                user_id=user.id,
                session_id=session.id,
                round_number=round_number,
                phase=1,
                pair_id=f"p1_0{round_number}",
                movie_a_tmdb_id=1000 + round_number,
                movie_b_tmdb_id=2000 + round_number,
                chosen_tmdb_id=1000 + round_number,
                pick_mode="watched",
                test_dimension="mainstream_vs_independent",
            ))
        await db_session.commit()

        mock_get_ai_pair.return_value = {
            "movie_a": _fake_movie(5301, "Movie 5301"),
            "movie_b": _fake_movie(5302, "Movie 5302"),
            "test_dimension": "slowburn",
        }

        first_response = await client.get("/sequencing/pair", headers=headers)
        second_response = await client.get("/sequencing/pair", headers=headers)

        assert first_response.status_code == 200
        assert second_response.status_code == 200
        assert first_response.json() == second_response.json()
        mock_get_ai_pair.assert_awaited_once()

    @pytest.mark.asyncio
    @patch("app.routers.sequencing.get_movie", new_callable=AsyncMock)
    @patch("app.routers.sequencing.get_ai_pair", new_callable=AsyncMock)
    async def test_phase2_reroll_persists_excluded_tmdb_ids(
        self, mock_get_ai_pair, mock_get_movie, client, auth_user, db_session
    ):
        mock_get_movie.side_effect = lambda tmdb_id: _fake_movie(tmdb_id, f"Movie {tmdb_id}")
        user, headers = auth_user

        await client.get("/sequencing/progress", headers=headers)
        session_result = await db_session.execute(
            select(SequencingSession).where(SequencingSession.user_id == user.id)
        )
        session = session_result.scalar_one()

        for round_number in range(1, 6):
            db_session.add(Pick(
                user_id=user.id,
                session_id=session.id,
                round_number=round_number,
                phase=1,
                pair_id=f"p1_0{round_number}",
                movie_a_tmdb_id=1000 + round_number,
                movie_b_tmdb_id=2000 + round_number,
                chosen_tmdb_id=1000 + round_number,
                pick_mode="watched",
                test_dimension="mainstream_vs_independent",
            ))
        await db_session.commit()

        mock_get_ai_pair.return_value = {
            "movie_a": _fake_movie(5201, "Movie 5201"),
            "movie_b": _fake_movie(5202, "Movie 5202"),
            "test_dimension": "slowburn",
        }

        response = await client.post(
            "/sequencing/reroll",
            json={"exclude_tmdb_ids": [6101, 6102]},
            headers=headers,
        )
        assert response.status_code == 200

        await db_session.refresh(session)
        assert session.reroll_excluded_tmdb_ids == [6101, 6102]
        assert set(mock_get_ai_pair.await_args.kwargs["extra_excluded_tmdb_ids"]) == {6101, 6102}


class TestPick:
    """POST /sequencing/pick"""

    @pytest.mark.asyncio
    @patch("app.routers.sequencing.get_movie", new_callable=AsyncMock)
    async def test_submit_pick_phase1(self, mock_get_movie, client, auth_user, db_session):
        mock_get_movie.side_effect = lambda tmdb_id: _fake_movie(tmdb_id, f"Movie {tmdb_id}")
        user, headers = auth_user

        # First get the pair to know valid tmdb_ids
        response = await client.get("/sequencing/pair", headers=headers)
        pair_data = response.json()
        chosen_id = pair_data["movie_a"]["tmdb_id"]

        response = await client.post(
            "/sequencing/pick",
            json={
                "chosen_tmdb_id": chosen_id,
                "pick_mode": "watched",
                "response_time_ms": 2500,
            },
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["round_number"] == 2
        assert data["completed"] is False

        # Verify pick was saved
        result = await db_session.execute(
            select(Pick).where(Pick.user_id == user.id)
        )
        picks = result.scalars().all()
        assert len(picks) == 1
        assert picks[0].round_number == 1

    @pytest.mark.asyncio
    async def test_submit_pick_phase2_persists_full_pair(
        self, client, auth_user, db_session
    ):
        user, headers = auth_user

        await client.get("/sequencing/progress", headers=headers)
        session_result = await db_session.execute(
            select(SequencingSession).where(SequencingSession.user_id == user.id)
        )
        session = session_result.scalar_one()

        for round_number in range(1, 6):
            db_session.add(Pick(
                user_id=user.id,
                session_id=session.id,
                round_number=round_number,
                phase=1,
                pair_id=f"p1_0{round_number}",
                movie_a_tmdb_id=1000 + round_number,
                movie_b_tmdb_id=2000 + round_number,
                chosen_tmdb_id=1000 + round_number,
                pick_mode="watched",
                test_dimension="mainstream_vs_independent",
            ))
        await db_session.commit()

        response = await client.post(
            "/sequencing/pick",
            json={
                "chosen_tmdb_id": 3001,
                "pick_mode": "attracted",
                "movie_a_tmdb_id": 3001,
                "movie_b_tmdb_id": 3002,
                "response_time_ms": 1800,
                "test_dimension": "mindfuck",
            },
            headers=headers,
        )
        assert response.status_code == 200

        result = await db_session.execute(
            select(Pick).where(Pick.user_id == user.id).order_by(Pick.round_number)
        )
        picks = result.scalars().all()
        phase2_pick = picks[-1]
        assert phase2_pick.phase == 2
        assert phase2_pick.movie_a_tmdb_id == 3001
        assert phase2_pick.movie_b_tmdb_id == 3002
        assert phase2_pick.chosen_tmdb_id == 3001
        assert phase2_pick.test_dimension == "mindfuck"

    @pytest.mark.asyncio
    async def test_submit_pick_phase2_rejects_missing_pair_context(
        self, client, auth_user, db_session
    ):
        user, headers = auth_user

        await client.get("/sequencing/progress", headers=headers)
        session_result = await db_session.execute(
            select(SequencingSession).where(SequencingSession.user_id == user.id)
        )
        session = session_result.scalar_one()

        for round_number in range(1, 6):
            db_session.add(Pick(
                user_id=user.id,
                session_id=session.id,
                round_number=round_number,
                phase=1,
                pair_id=f"p1_0{round_number}",
                movie_a_tmdb_id=1000 + round_number,
                movie_b_tmdb_id=2000 + round_number,
                chosen_tmdb_id=1000 + round_number,
                pick_mode="watched",
                test_dimension="mainstream_vs_independent",
            ))
        await db_session.commit()

        response = await client.post(
            "/sequencing/pick",
            json={
                "chosen_tmdb_id": 3001,
                "pick_mode": "attracted",
                "response_time_ms": 1800,
                "test_dimension": "mindfuck",
            },
            headers=headers,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    @patch("app.routers.sequencing._enqueue_dna_build", new_callable=AsyncMock)
    @patch("app.routers.sequencing.get_movie", new_callable=AsyncMock)
    async def test_submit_pick_final_round_enqueues_dna_build(
        self, mock_get_movie, mock_enqueue_dna_build, client, auth_user, db_session
    ):
        mock_get_movie.side_effect = lambda tmdb_id: _fake_movie(tmdb_id, f"Movie {tmdb_id}")
        user, headers = auth_user

        await client.get("/sequencing/progress", headers=headers)
        session_result = await db_session.execute(
            select(SequencingSession).where(SequencingSession.user_id == user.id)
        )
        session = session_result.scalar_one()
        session.total_rounds = 1
        await db_session.commit()

        # Get the pair first so we know valid tmdb_ids
        pair_resp = await client.get("/sequencing/pair", headers=headers)
        chosen_id = pair_resp.json()["movie_a"]["tmdb_id"]

        response = await client.post(
            "/sequencing/pick",
            json={
                "chosen_tmdb_id": chosen_id,
                "pick_mode": "watched",
                "response_time_ms": 2500,
            },
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["completed"] is True

        await db_session.refresh(user)
        assert user.sequencing_status == SequencingStatus.completed
        mock_enqueue_dna_build.assert_awaited_once_with(user.id)


class TestSkip:
    """POST /sequencing/skip"""

    @pytest.mark.asyncio
    @patch("app.routers.sequencing.get_movie", new_callable=AsyncMock)
    async def test_skip_pair(self, mock_get_movie, client, auth_user, db_session):
        mock_get_movie.return_value = _fake_movie()
        user, headers = auth_user

        response = await client.post(
            "/sequencing/skip",
            json={"response_time_ms": 1000},
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["round_number"] == 2

        # Verify skip was saved with no chosen movie
        result = await db_session.execute(
            select(Pick).where(Pick.user_id == user.id)
        )
        picks = result.scalars().all()
        assert len(picks) == 1
        assert picks[0].chosen_tmdb_id is None

    @pytest.mark.asyncio
    async def test_skip_phase2_persists_full_pair(self, client, auth_user, db_session):
        user, headers = auth_user

        await client.get("/sequencing/progress", headers=headers)
        session_result = await db_session.execute(
            select(SequencingSession).where(SequencingSession.user_id == user.id)
        )
        session = session_result.scalar_one()

        for round_number in range(1, 6):
            db_session.add(Pick(
                user_id=user.id,
                session_id=session.id,
                round_number=round_number,
                phase=1,
                pair_id=f"p1_0{round_number}",
                movie_a_tmdb_id=1000 + round_number,
                movie_b_tmdb_id=2000 + round_number,
                chosen_tmdb_id=1000 + round_number,
                pick_mode="watched",
                test_dimension="mainstream_vs_independent",
            ))
        await db_session.commit()

        response = await client.post(
            "/sequencing/skip",
            json={
                "movie_a_tmdb_id": 3101,
                "movie_b_tmdb_id": 3102,
                "response_time_ms": 900,
                "test_dimension": "slowburn",
            },
            headers=headers,
        )
        assert response.status_code == 200

        result = await db_session.execute(
            select(Pick).where(Pick.user_id == user.id).order_by(Pick.round_number)
        )
        picks = result.scalars().all()
        phase2_skip = picks[-1]
        assert phase2_skip.phase == 2
        assert phase2_skip.movie_a_tmdb_id == 3101
        assert phase2_skip.movie_b_tmdb_id == 3102
        assert phase2_skip.chosen_tmdb_id is None
        assert phase2_skip.test_dimension == "slowburn"

    @pytest.mark.asyncio
    @patch("app.routers.sequencing._enqueue_dna_build", new_callable=AsyncMock)
    @patch("app.routers.sequencing.get_movie", new_callable=AsyncMock)
    async def test_skip_final_round_enqueues_dna_build(
        self, mock_get_movie, mock_enqueue_dna_build, client, auth_user, db_session
    ):
        mock_get_movie.return_value = _fake_movie()
        user, headers = auth_user

        await client.get("/sequencing/progress", headers=headers)
        session_result = await db_session.execute(
            select(SequencingSession).where(SequencingSession.user_id == user.id)
        )
        session = session_result.scalar_one()
        session.total_rounds = 1
        await db_session.commit()

        response = await client.post(
            "/sequencing/skip",
            json={"response_time_ms": 1000},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["completed"] is True

        await db_session.refresh(user)
        assert user.sequencing_status == SequencingStatus.completed
        mock_enqueue_dna_build.assert_awaited_once_with(user.id)
