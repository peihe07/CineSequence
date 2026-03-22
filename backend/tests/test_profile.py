"""Tests for profile CRUD endpoints."""

import io

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, Gender, SequencingStatus
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
    token = create_access_token(user.id)
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

    async def test_update_empty_body_returns_400(self, client: AsyncClient, db_session: AsyncSession):
        user = await create_user(db_session)
        response = await client.patch(
            "/profile",
            json={},
            headers=auth_headers(user),
        )
        assert response.status_code == 400

    async def test_update_ignores_disallowed_fields(self, client: AsyncClient, db_session: AsyncSession):
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

    async def test_upload_unauthenticated(self, client: AsyncClient):
        response = await client.post(
            "/profile/avatar",
            files={"file": ("a.jpg", io.BytesIO(b"\xff\xd8"), "image/jpeg")},
        )
        assert response.status_code == 401
