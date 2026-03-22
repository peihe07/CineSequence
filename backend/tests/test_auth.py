"""Tests for authentication flow."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.config import settings
from app.services.auth_utils import (
    create_access_token,
    create_magic_link_token,
    decode_access_token,
    verify_magic_link_token,
)


# --- Unit tests for auth_utils ---


class TestMagicLinkToken:
    def test_create_and_verify(self):
        token, expires_at = create_magic_link_token("test@example.com")
        email = verify_magic_link_token(token)
        assert email == "test@example.com"

    def test_reissued_tokens_are_unique(self):
        first, _ = create_magic_link_token("test@example.com")
        second, _ = create_magic_link_token("test@example.com")
        assert first != second

    def test_invalid_token_returns_none(self):
        assert verify_magic_link_token("garbage") is None

    def test_tampered_token_returns_none(self):
        token, _ = create_magic_link_token("test@example.com")
        tampered = token + "x"
        assert verify_magic_link_token(tampered) is None


class TestAccessToken:
    def test_create_and_decode(self):
        user_id = uuid.uuid4()
        token = create_access_token(user_id, auth_version=1)
        decoded = decode_access_token(token)
        assert decoded == (user_id, 1)

    def test_invalid_token_returns_none(self):
        assert decode_access_token("garbage") is None


# --- Integration tests for auth endpoints ---


@pytest.mark.asyncio
class TestRegisterEndpoint:
    @patch("app.routers.auth.send_magic_link", new_callable=AsyncMock)
    async def test_register_success(self, mock_send, client: AsyncClient):
        response = await client.post("/auth/register", json={
            "email": "user@test.com",
            "name": "Test User",
            "gender": "other",
            "region": "TW",
            "agreed_to_terms": True,
        })
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "user@test.com"
        assert data["name"] == "Test User"
        assert data["sequencing_status"] == "not_started"
        mock_send.assert_called_once()

    @patch("app.routers.auth.send_magic_link", new_callable=AsyncMock)
    async def test_register_duplicate_email(self, mock_send, client: AsyncClient):
        payload = {
            "email": "dup@test.com",
            "name": "User A",
            "gender": "male",
            "agreed_to_terms": True,
        }
        first = await client.post("/auth/register", json=payload)
        assert first.status_code == 201

        response = await client.post("/auth/register", json={**payload, "name": "User B"})
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == payload["email"]
        assert data["name"] == payload["name"]
        assert mock_send.await_count == 1

    @patch("app.routers.auth.send_magic_link", new_callable=AsyncMock)
    async def test_register_grants_admin_for_allowlisted_email(
        self, mock_send, client: AsyncClient, db_session: AsyncSession
    ):
        original = settings.admin_emails
        settings.admin_emails = "y45076@gmail.com"
        try:
            response = await client.post("/auth/register", json={
                "email": "y45076@gmail.com",
                "name": "Admin User",
                "gender": "other",
                "region": "TW",
                "agreed_to_terms": True,
            })
            assert response.status_code == 201

            result = await db_session.execute(
                select(User).where(User.email == "y45076@gmail.com")
            )
            assert result.scalar_one().is_admin is True
        finally:
            settings.admin_emails = original


@pytest.mark.asyncio
class TestVerifyEndpoint:
    @patch("app.routers.auth.send_magic_link", new_callable=AsyncMock)
    async def test_verify_success(
        self, mock_send, client: AsyncClient, db_session: AsyncSession
    ):
        # Register first
        await client.post("/auth/register", json={
            "email": "verify@test.com",
            "name": "Verifier",
            "gender": "female",
            "agreed_to_terms": True,
        })

        result = await db_session.execute(
            select(User).where(User.email == "verify@test.com")
        )
        token = result.scalar_one().magic_link_token

        response = await client.post("/auth/verify", json={"token": token})
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        cookie = response.cookies.get("cine_sequence_session")
        assert cookie == data["access_token"]

    @patch("app.routers.auth.send_magic_link", new_callable=AsyncMock)
    async def test_verify_rejects_reused_token(
        self, mock_send, client: AsyncClient, db_session: AsyncSession
    ):
        await client.post("/auth/register", json={
            "email": "reused@test.com",
            "name": "Reuse",
            "gender": "female",
            "agreed_to_terms": True,
        })
        result = await db_session.execute(
            select(User).where(User.email == "reused@test.com")
        )
        token = result.scalar_one().magic_link_token

        first = await client.post("/auth/verify", json={"token": token})
        assert first.status_code == 200

        second = await client.post("/auth/verify", json={"token": token})
        assert second.status_code == 401

    @patch("app.routers.auth.send_magic_link", new_callable=AsyncMock)
    async def test_verify_rejects_superseded_token(
        self, mock_send, client: AsyncClient, db_session: AsyncSession
    ):
        await client.post("/auth/register", json={
            "email": "superseded@test.com",
            "name": "Superseded",
            "gender": "female",
            "agreed_to_terms": True,
        })
        result = await db_session.execute(
            select(User).where(User.email == "superseded@test.com")
        )
        old_token = result.scalar_one().magic_link_token

        login_response = await client.post("/auth/login", json={"email": "superseded@test.com"})
        assert login_response.status_code == 200

        result = await db_session.execute(
            select(User).where(User.email == "superseded@test.com")
        )
        new_token = result.scalar_one().magic_link_token
        assert new_token != old_token

        old_verify = await client.post("/auth/verify", json={"token": old_token})
        assert old_verify.status_code == 401

        new_verify = await client.post("/auth/verify", json={"token": new_token})
        assert new_verify.status_code == 200

    async def test_verify_invalid_token(self, client: AsyncClient):
        response = await client.post("/auth/verify", json={"token": "bad-token"})
        assert response.status_code == 401


@pytest.mark.asyncio
class TestLoginEndpoint:
    @patch("app.routers.auth.send_magic_link", new_callable=AsyncMock)
    async def test_login_existing_user(self, mock_send, client: AsyncClient):
        # Register
        await client.post("/auth/register", json={
            "email": "login@test.com",
            "name": "Login User",
            "gender": "male",
            "agreed_to_terms": True,
        })
        mock_send.reset_mock()

        # Login
        response = await client.post("/auth/login", json={"email": "login@test.com"})
        assert response.status_code == 200
        mock_send.assert_called_once()

    async def test_login_unknown_email(self, client: AsyncClient):
        response = await client.post("/auth/login", json={"email": "unknown@test.com"})
        assert response.status_code == 200
        assert response.json() == {
            "message": "If this email is registered, a magic link has been sent."
        }

    @patch("app.routers.auth.send_magic_link", new_callable=AsyncMock)
    async def test_login_syncs_admin_for_allowlisted_existing_user(
        self, mock_send, client: AsyncClient, db_session: AsyncSession
    ):
        await client.post("/auth/register", json={
            "email": "y45076@gmail.com",
            "name": "Admin User",
            "gender": "other",
            "region": "TW",
            "agreed_to_terms": True,
        })

        result = await db_session.execute(
            select(User).where(User.email == "y45076@gmail.com")
        )
        user = result.scalar_one()
        user.is_admin = False
        await db_session.commit()

        original = settings.admin_emails
        settings.admin_emails = "y45076@gmail.com"
        try:
            response = await client.post("/auth/login", json={"email": "y45076@gmail.com"})
            assert response.status_code == 200

            result = await db_session.execute(
                select(User).where(User.email == "y45076@gmail.com")
            )
            assert result.scalar_one().is_admin is True
        finally:
            settings.admin_emails = original

    async def test_login_rejects_untrusted_origin(self, client: AsyncClient):
        response = await client.post(
            "/auth/login",
            json={"email": "unknown@test.com"},
            headers={"Origin": "https://evil.example"},
        )
        assert response.status_code == 403


@pytest.mark.asyncio
class TestSessionEndpoints:
    async def test_dev_session_sets_cookie_and_allows_profile_access(
        self, client: AsyncClient
    ):
        response = await client.post("/auth/dev/session", json={
            "email": "cookie-session@test.com",
            "name": "Cookie Session",
            "gender": "other",
            "region": "TW",
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert response.cookies.get("cine_sequence_session") == data["access_token"]

        profile = await client.get("/profile")
        assert profile.status_code == 200
        assert profile.json()["email"] == "cookie-session@test.com"

    async def test_logout_clears_cookie(self, client: AsyncClient):
        session = await client.post("/auth/dev/session", json={
            "email": "logout@test.com",
            "name": "Logout User",
            "gender": "other",
            "region": "TW",
        })
        assert session.status_code == 200

        response = await client.post("/auth/logout")
        assert response.status_code == 204

        profile = await client.get("/profile")
        assert profile.status_code == 401

    async def test_logout_revokes_existing_access_token(self, client: AsyncClient):
        session = await client.post("/auth/dev/session", json={
            "email": "revoke@test.com",
            "name": "Revoke User",
            "gender": "other",
            "region": "TW",
        })
        assert session.status_code == 200
        access_token = session.json()["access_token"]

        response = await client.post("/auth/logout")
        assert response.status_code == 204

        profile = await client.get(
            "/profile",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert profile.status_code == 401

    @patch("app.routers.auth.send_magic_link", new_callable=AsyncMock)
    async def test_dev_magic_link_returns_current_token(
        self, mock_send, client: AsyncClient, db_session: AsyncSession
    ):
        await client.post("/auth/register", json={
            "email": "magic-link@test.com",
            "name": "Magic Link",
            "gender": "other",
            "region": "TW",
            "agreed_to_terms": True,
        })

        result = await db_session.execute(
            select(User).where(User.email == "magic-link@test.com")
        )
        token = result.scalar_one().magic_link_token

        response = await client.post("/auth/dev/magic-link", json={
            "email": "magic-link@test.com",
        })
        assert response.status_code == 200
        assert response.json() == {"token": token}

    async def test_dev_magic_link_404_without_pending_token(self, client: AsyncClient):
        response = await client.post("/auth/dev/magic-link", json={
            "email": "missing@test.com",
        })
        assert response.status_code == 404

    async def test_dev_session_grants_admin_for_allowlisted_email(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        original = settings.admin_emails
        settings.admin_emails = "y45076@gmail.com"
        try:
            response = await client.post("/auth/dev/session", json={
                "email": "y45076@gmail.com",
                "name": "Admin User",
                "gender": "other",
                "region": "TW",
            })
            assert response.status_code == 200

            result = await db_session.execute(
                select(User).where(User.email == "y45076@gmail.com")
            )
            assert result.scalar_one().is_admin is True
        finally:
            settings.admin_emails = original


@pytest.mark.asyncio
class TestProtectedEndpoint:
    async def test_no_token_returns_403(self, client: AsyncClient):
        response = await client.get("/profile")
        assert response.status_code == 401

    @patch("app.routers.auth.send_magic_link", new_callable=AsyncMock)
    async def test_valid_token_succeeds(
        self, mock_send, client: AsyncClient, db_session: AsyncSession
    ):
        # Register + verify to get a token
        await client.post("/auth/register", json={
            "email": "auth@test.com",
            "name": "Auth User",
            "gender": "other",
            "agreed_to_terms": True,
        })
        result = await db_session.execute(
            select(User).where(User.email == "auth@test.com")
        )
        token = result.scalar_one().magic_link_token
        verify_resp = await client.post("/auth/verify", json={"token": token})
        access_token = verify_resp.json()["access_token"]

        response = await client.get(
            "/profile",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert response.status_code == 200
        assert response.json()["email"] == "auth@test.com"
