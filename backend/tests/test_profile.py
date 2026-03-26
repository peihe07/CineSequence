"""Tests for profile CRUD endpoints."""

import io
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dna_profile import DnaProfile
from app.models.group import Group, group_members
from app.models.group_message import GroupMessage
from app.models.match import Match, MatchStatus
from app.models.notification import Notification, NotificationType
from app.models.pick import Pick
from app.models.sequencing_session import SequencingSession, SessionStatus, SessionType
from app.models.user import Gender, SequencingStatus, User
from app.services.auth_utils import create_access_token


async def create_user(db: AsyncSession, email: str = "profile@test.com") -> User:
    user = User(
        email=email,
        name="Profile User",
        gender=Gender.female,
        region="TW",
        sequencing_status=SequencingStatus.not_started,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


def auth_headers(user: User) -> dict:
    token = create_access_token(user.id, user.auth_version)
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
class TestGetProfile:
    async def test_get_profile_success(self, client: AsyncClient, db_session: AsyncSession):
        user = await create_user(db_session)
        response = await client.get("/profile", headers=auth_headers(user))
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "profile@test.com"
        assert data["name"] == "Profile User"
        assert data["gender"] == "female"
        assert data["region"] == "TW"
        assert data["sequencing_status"] == "not_started"

    async def test_get_profile_unauthenticated(self, client: AsyncClient):
        response = await client.get("/profile")
        assert response.status_code == 401


@pytest.mark.asyncio
class TestUpdateProfile:
    async def test_update_name(self, client: AsyncClient, db_session: AsyncSession):
        user = await create_user(db_session)
        response = await client.patch(
            "/profile",
            json={"name": "New Name"},
            headers=auth_headers(user),
        )
        assert response.status_code == 200
        assert response.json()["name"] == "New Name"

    async def test_update_bio(self, client: AsyncClient, db_session: AsyncSession):
        user = await create_user(db_session)
        response = await client.patch(
            "/profile",
            json={"bio": "Long walks, quiet cinemas, and difficult endings."},
            headers=auth_headers(user),
        )
        assert response.status_code == 200
        assert response.json()["bio"] == "Long walks, quiet cinemas, and difficult endings."

    async def test_update_name_rolls_back_when_personal_ticket_regeneration_fails(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        user = await create_user(db_session)
        user.sequencing_status = SequencingStatus.completed
        profile = DnaProfile(
            user_id=user.id,
            archetype_id="time-traveler",
            tag_vector=[0.6] * 30,
            genre_vector={"Drama": 1.0},
            quadrant_scores={},
            ticket_style="classic",
            is_active=True,
        )
        db_session.add(profile)
        await db_session.commit()
        headers = auth_headers(user)

        with patch(
            "app.routers.profile._regenerate_personal_ticket",
            new=AsyncMock(side_effect=RuntimeError("ticket generation failed")),
        ):
            response = await client.patch(
                "/profile",
                json={"name": "New Name"},
                headers=headers,
            )

        assert response.status_code == 500

        assert db_session.bind is not None
        async with AsyncSession(db_session.bind, expire_on_commit=False) as verify_session:
            persisted_name = await verify_session.scalar(
                select(User.name).where(User.id == user.id)
            )
        assert persisted_name == "Profile User"

    async def test_update_multiple_fields(self, client: AsyncClient, db_session: AsyncSession):
        user = await create_user(db_session)
        response = await client.patch(
            "/profile",
            json={"name": "Updated", "region": "US", "birth_year": 1990},
            headers=auth_headers(user),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated"
        assert data["region"] == "US"
        assert data["birth_year"] == 1990

    async def test_update_match_preferences(self, client: AsyncClient, db_session: AsyncSession):
        user = await create_user(db_session)
        response = await client.patch(
            "/profile",
            json={
                "match_gender_pref": "female",
                "match_age_min": 25,
                "match_age_max": 35,
                "pure_taste_match": True,
            },
            headers=auth_headers(user),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["match_gender_pref"] == "female"
        assert data["match_age_min"] == 25
        assert data["match_age_max"] == 35
        assert data["pure_taste_match"] is True

    async def test_update_empty_body_returns_400(
        self, client: AsyncClient, db_session: AsyncSession,
    ):
        user = await create_user(db_session)
        response = await client.patch(
            "/profile",
            json={},
            headers=auth_headers(user),
        )
        assert response.status_code == 400

    async def test_update_ignores_disallowed_fields(
        self, client: AsyncClient, db_session: AsyncSession,
    ):
        user = await create_user(db_session)
        original_email = user.email
        response = await client.patch(
            "/profile",
            json={"name": "Safe Update"},
            headers=auth_headers(user),
        )
        assert response.status_code == 200
        assert response.json()["email"] == original_email

    async def test_update_unauthenticated(self, client: AsyncClient):
        response = await client.patch("/profile", json={"name": "Hacker"})
        assert response.status_code == 401


@pytest.mark.asyncio
class TestAvatarUpload:
    async def test_upload_jpeg(self, client: AsyncClient, db_session: AsyncSession):
        user = await create_user(db_session)
        # Minimal JPEG header bytes
        fake_jpeg = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        response = await client.post(
            "/profile/avatar",
            headers=auth_headers(user),
            files={"file": ("avatar.jpg", io.BytesIO(fake_jpeg), "image/jpeg")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["avatar_url"] is not None
        assert "avatar" in data["avatar_url"]

    async def test_reupload_returns_cache_busting_avatar_url(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        user = await create_user(db_session)
        fake_png_a = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
        fake_png_b = b"\x89PNG\r\n\x1a\n" + b"\x01" * 64

        first = await client.post(
            "/profile/avatar",
            headers=auth_headers(user),
            files={"file": ("avatar.png", io.BytesIO(fake_png_a), "image/png")},
        )
        second = await client.post(
            "/profile/avatar",
            headers=auth_headers(user),
            files={"file": ("avatar.png", io.BytesIO(fake_png_b), "image/png")},
        )

        assert first.status_code == 200
        assert second.status_code == 200
        first_url = first.json()["avatar_url"]
        second_url = second.json()["avatar_url"]
        assert first_url != second_url
        assert first_url.split("?")[0] == second_url.split("?")[0]

    async def test_upload_rejects_invalid_type(self, client: AsyncClient, db_session: AsyncSession):
        user = await create_user(db_session)
        response = await client.post(
            "/profile/avatar",
            headers=auth_headers(user),
            files={"file": ("doc.pdf", io.BytesIO(b"fake pdf"), "application/pdf")},
        )
        assert response.status_code == 400
        assert "JPEG" in response.json()["detail"]

    async def test_upload_rejects_large_file(self, client: AsyncClient, db_session: AsyncSession):
        user = await create_user(db_session)
        large_data = b"\x00" * (3 * 1024 * 1024)  # 3 MB
        response = await client.post(
            "/profile/avatar",
            headers=auth_headers(user),
            files={"file": ("big.png", io.BytesIO(large_data), "image/png")},
        )
        assert response.status_code == 400
        assert "2 MB" in response.json()["detail"]

    async def test_upload_rejects_mismatched_file_signature(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        user = await create_user(db_session)
        fake_png = b"not-a-real-png"
        response = await client.post(
            "/profile/avatar",
            headers=auth_headers(user),
            files={"file": ("avatar.png", io.BytesIO(fake_png), "image/png")},
        )
        assert response.status_code == 400
        assert "declared image type" in response.json()["detail"]

    async def test_upload_unauthenticated(self, client: AsyncClient):
        response = await client.post(
            "/profile/avatar",
            files={"file": ("a.jpg", io.BytesIO(b"\xff\xd8"), "image/jpeg")},
        )
        assert response.status_code == 401


@pytest.mark.asyncio
class TestDeleteAccount:
    async def test_delete_account_removes_related_data_and_invalidates_token(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        user = await create_user(db_session, email="delete@test.com")
        other_user = await create_user(db_session, email="other@test.com")

        group = Group(
            id="mobius_loop",
            name="Mobius Loop",
            subtitle="Mind-benders only",
            icon="ri-tornado-line",
            primary_tags=["mindfuck"],
            is_hidden=False,
            min_members_to_activate=2,
            member_count=2,
            is_active=True,
        )
        db_session.add(group)
        await db_session.commit()

        session = SequencingSession(
            user_id=user.id,
            session_type=SessionType.initial,
            status=SessionStatus.completed,
            total_rounds=20,
        )
        db_session.add(session)
        await db_session.flush()
        user.active_session_id = session.id
        await db_session.flush()

        db_session.add(DnaProfile(
            user_id=user.id,
            session_id=session.id,
            archetype_id="time-traveler",
            tag_vector=[0.8] * 30,
            genre_vector={},
            quadrant_scores={},
            ticket_style="classic",
            is_active=True,
        ))
        db_session.add(Pick(
            user_id=user.id,
            session_id=session.id,
            round_number=1,
            phase=1,
            movie_a_tmdb_id=1,
            movie_b_tmdb_id=2,
            chosen_tmdb_id=1,
            pick_mode="watched",
        ))
        db_session.add(Match(
            user_a_id=user.id,
            user_b_id=other_user.id,
            similarity_score=0.91,
            status=MatchStatus.invited,
        ))
        db_session.add(Notification(
            user_id=user.id,
            type=NotificationType.system,
            title_zh="系統通知",
            title_en="System notice",
        ))
        db_session.add(GroupMessage(
            group_id=group.id,
            user_id=user.id,
            body="Goodbye theater.",
        ))
        await db_session.execute(
            group_members.insert().values(user_id=user.id, group_id=group.id)
        )
        await db_session.execute(
            group_members.insert().values(user_id=other_user.id, group_id=group.id)
        )
        await db_session.commit()

        headers = auth_headers(user)
        response = await client.delete("/profile", headers=headers)

        assert response.status_code == 200
        assert "account" in response.json()["message"].lower()
        set_cookie = response.headers.get("set-cookie", "")
        assert "cine_sequence_session=" in set_cookie

        assert await db_session.get(User, user.id) is None

        pick_rows = await db_session.execute(select(Pick).where(Pick.user_id == user.id))
        assert pick_rows.scalars().all() == []

        dna_rows = await db_session.execute(
            select(DnaProfile).where(DnaProfile.user_id == user.id)
        )
        assert dna_rows.scalars().all() == []

        session_rows = await db_session.execute(
            select(SequencingSession).where(SequencingSession.user_id == user.id)
        )
        assert session_rows.scalars().all() == []

        match_rows = await db_session.execute(
            select(Match).where((Match.user_a_id == user.id) | (Match.user_b_id == user.id))
        )
        assert match_rows.scalars().all() == []

        notification_rows = await db_session.execute(
            select(Notification).where(Notification.user_id == user.id)
        )
        assert notification_rows.scalars().all() == []

        message_rows = await db_session.execute(
            select(GroupMessage).where(GroupMessage.user_id == user.id)
        )
        assert message_rows.scalars().all() == []

        membership_rows = await db_session.execute(
            select(group_members).where(group_members.c.user_id == user.id)
        )
        assert membership_rows.all() == []

        await db_session.refresh(group)
        assert group.member_count == 1
        assert group.is_active is False

        stale_token_response = await client.get("/profile", headers=headers)
        assert stale_token_response.status_code == 401
