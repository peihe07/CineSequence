"""Tests for admin dashboard API endpoints."""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.match import Match, MatchStatus
from app.models.user import Gender, SequencingStatus, User
from app.models.waitlist_entry import WaitlistEntry
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

    async def test_stats_funnel_counts_users_from_both_match_sides(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        admin = await create_user(db_session, email="admin@test.com", is_admin=True)
        user_b = await create_user(db_session, email="userb@test.com")
        user_c = await create_user(db_session, email="userc@test.com")

        db_session.add(Match(
            user_a_id=admin.id,
            user_b_id=user_b.id,
            similarity_score=0.9,
            status=MatchStatus.accepted,
        ))
        db_session.add(Match(
            user_a_id=user_c.id,
            user_b_id=admin.id,
            similarity_score=0.88,
            status=MatchStatus.invited,
        ))
        await db_session.commit()

        response = await client.get("/admin/stats", headers=auth_headers(admin))
        data = response.json()

        assert data["funnel"]["has_match"] == 3


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


@pytest.mark.asyncio
class TestAdminWaitlist:
    async def test_waitlist_returns_entries_sorted_newest_first(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        admin = await create_user(db_session, is_admin=True)
        older = WaitlistEntry(
            email="older@test.com",
            source="landing",
            created_at=datetime.now(UTC) - timedelta(days=1),
        )
        newer = WaitlistEntry(
            email="newer@test.com",
            source="popup",
            created_at=datetime.now(UTC),
        )
        db_session.add_all([older, newer])
        await db_session.commit()

        response = await client.get("/admin/waitlist", headers=auth_headers(admin))

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert [entry["email"] for entry in data["entries"]] == [
            "newer@test.com",
            "older@test.com",
        ]
        assert data["entries"][0]["source"] == "popup"
        assert "created_at" in data["entries"][0]

    async def test_waitlist_supports_limit(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        admin = await create_user(db_session, is_admin=True)
        db_session.add_all([
            WaitlistEntry(email="one@test.com"),
            WaitlistEntry(email="two@test.com"),
            WaitlistEntry(email="three@test.com"),
        ])
        await db_session.commit()

        response = await client.get("/admin/waitlist?limit=2", headers=auth_headers(admin))

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        assert len(data["entries"]) == 2
