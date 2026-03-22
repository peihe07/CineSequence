"""Tests for admin dashboard API endpoints."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, Gender, SequencingStatus
from app.models.dna_profile import DnaProfile
from app.models.match import Match, MatchStatus
from app.services.auth_utils import create_access_token


async def create_user(
    db: AsyncSession,
    email: str = "admin@test.com",
    is_admin: bool = False,
    sequencing_status: SequencingStatus = SequencingStatus.not_started,
) -> User:
    """Helper to create a user in the test DB."""
    user = User(
        email=email,
        name="Test User",
        gender=Gender.other,
        region="TW",
        is_admin=is_admin,
        sequencing_status=sequencing_status,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


def auth_headers(user: User) -> dict:
    token = create_access_token(user.id, user.auth_version)
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
class TestAdminAuth:
    async def test_non_admin_gets_403(self, client: AsyncClient, db_session: AsyncSession):
        user = await create_user(db_session, is_admin=False)
        response = await client.get("/admin/stats", headers=auth_headers(user))
        assert response.status_code == 403

    async def test_unauthenticated_gets_401(self, client: AsyncClient):
        response = await client.get("/admin/stats")
        assert response.status_code == 401

    async def test_admin_gets_200(self, client: AsyncClient, db_session: AsyncSession):
        admin = await create_user(db_session, is_admin=True)
        response = await client.get("/admin/stats", headers=auth_headers(admin))
        assert response.status_code == 200


@pytest.mark.asyncio
class TestAdminStats:
    async def test_stats_returns_correct_structure(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        admin = await create_user(db_session, is_admin=True)
        response = await client.get("/admin/stats", headers=auth_headers(admin))
        data = response.json()

        assert "users" in data
        assert "dna" in data
        assert "matches" in data
        assert "funnel" in data

        assert "total" in data["users"]
        assert "today" in data["users"]
        assert "this_week" in data["users"]
        assert "sequencing_breakdown" in data["users"]

    async def test_stats_counts_users(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        admin = await create_user(db_session, email="admin@test.com", is_admin=True)
        await create_user(db_session, email="user1@test.com")
        await create_user(db_session, email="user2@test.com")

        response = await client.get("/admin/stats", headers=auth_headers(admin))
        data = response.json()

        assert data["users"]["total"] == 3  # admin + 2 users

    async def test_stats_funnel(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        admin = await create_user(
            db_session, email="admin@test.com", is_admin=True,
            sequencing_status=SequencingStatus.completed,
        )
        await create_user(
            db_session, email="completed@test.com",
            sequencing_status=SequencingStatus.completed,
        )
        await create_user(
            db_session, email="started@test.com",
            sequencing_status=SequencingStatus.in_progress,
        )

        response = await client.get("/admin/stats", headers=auth_headers(admin))
        data = response.json()

        assert data["funnel"]["registered"] == 3
        assert data["funnel"]["completed_sequencing"] == 2

    async def test_stats_match_breakdown(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        admin = await create_user(db_session, email="admin@test.com", is_admin=True)
        user_b = await create_user(db_session, email="userb@test.com")

        match = Match(
            user_a_id=admin.id,
            user_b_id=user_b.id,
            similarity_score=0.85,
            status=MatchStatus.accepted,
        )
        db_session.add(match)
        await db_session.commit()

        response = await client.get("/admin/stats", headers=auth_headers(admin))
        data = response.json()

        assert data["matches"]["total"] == 1
        assert data["matches"]["status_breakdown"]["accepted"] == 1


@pytest.mark.asyncio
class TestAdminDailyStats:
    async def test_daily_stats_returns_correct_structure(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        admin = await create_user(db_session, is_admin=True)
        response = await client.get(
            "/admin/stats/daily?days=7", headers=auth_headers(admin)
        )
        data = response.json()

        assert data["days"] == 7
        assert "registrations" in data
        assert "dna_builds" in data
        assert "matches" in data

    async def test_daily_stats_caps_at_90_days(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        admin = await create_user(db_session, is_admin=True)
        response = await client.get(
            "/admin/stats/daily?days=365", headers=auth_headers(admin)
        )
        data = response.json()
        assert data["days"] == 90


@pytest.mark.asyncio
class TestAdminApiUsage:
    async def test_api_usage_returns_correct_structure(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        admin = await create_user(db_session, is_admin=True)
        response = await client.get("/admin/api-usage", headers=auth_headers(admin))
        data = response.json()

        assert "gemini" in data
        assert "tmdb" in data
        assert "resend" in data
        assert "estimated_total" in data["gemini"]
        assert "estimated_queries" in data["tmdb"]
        assert "estimated_total" in data["resend"]
