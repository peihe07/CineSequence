"""Tests for sequencing router: integration tests for the pick/skip/progress flow."""

from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.pick import Pick
from app.models.user import SequencingStatus, User
from app.services.auth_utils import create_access_token
from app.services.tmdb_client import MovieInfo


# Fake TMDB movie for mocking
def _fake_movie(tmdb_id: int = 155, title: str = "Test Movie") -> MovieInfo:
    return MovieInfo(
        tmdb_id=tmdb_id,
        title_en=title,
        title_zh=f"{title}_zh",
        poster_url=f"https://image.tmdb.org/t/p/w500/test.jpg",
        year=2020,
        genres=["Drama"],
        overview="A test movie",
    )


@pytest_asyncio.fixture
async def auth_user(db_session):
    """Create a test user and return (user, auth_headers)."""
    user = User(
        email="test@example.com",
        display_name="Test User",
        sequencing_status=SequencingStatus.not_started,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = create_access_token(str(user.id))
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
        assert response.status_code == 403


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


class TestPick:
    """POST /sequencing/pick"""

    @pytest.mark.asyncio
    @patch("app.routers.sequencing.get_movie", new_callable=AsyncMock)
    async def test_submit_pick_phase1(self, mock_get_movie, client, auth_user, db_session):
        mock_get_movie.return_value = _fake_movie()
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
