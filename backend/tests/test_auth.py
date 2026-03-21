"""Tests for authentication flow."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

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

    def test_invalid_token_returns_none(self):
        assert verify_magic_link_token("garbage") is None

    def test_tampered_token_returns_none(self):
        token, _ = create_magic_link_token("test@example.com")
        tampered = token + "x"
        assert verify_magic_link_token(tampered) is None


class TestAccessToken:
    def test_create_and_decode(self):
        user_id = uuid.uuid4()
        token = create_access_token(user_id)
        decoded = decode_access_token(token)
        assert decoded == user_id

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
        }
        await client.post("/auth/register", json=payload)
        response = await client.post("/auth/register", json={**payload, "name": "User B"})
        assert response.status_code == 409


@pytest.mark.asyncio
class TestVerifyEndpoint:
    @patch("app.routers.auth.send_magic_link", new_callable=AsyncMock)
    async def test_verify_success(self, mock_send, client: AsyncClient):
        # Register first
        await client.post("/auth/register", json={
            "email": "verify@test.com",
            "name": "Verifier",
            "gender": "female",
        })

        # Create a valid token
        token, _ = create_magic_link_token("verify@test.com")

        response = await client.post("/auth/verify", json={"token": token})
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

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
        })
        mock_send.reset_mock()

        # Login
        response = await client.post("/auth/login", json={"email": "login@test.com"})
        assert response.status_code == 200
        mock_send.assert_called_once()

    async def test_login_unknown_email(self, client: AsyncClient):
        response = await client.post("/auth/login", json={"email": "unknown@test.com"})
        assert response.status_code == 404


@pytest.mark.asyncio
class TestProtectedEndpoint:
    async def test_no_token_returns_403(self, client: AsyncClient):
        response = await client.get("/profile")
        assert response.status_code == 403

    @patch("app.routers.auth.send_magic_link", new_callable=AsyncMock)
    async def test_valid_token_succeeds(self, mock_send, client: AsyncClient):
        # Register + verify to get a token
        await client.post("/auth/register", json={
            "email": "auth@test.com",
            "name": "Auth User",
            "gender": "other",
        })
        token, _ = create_magic_link_token("auth@test.com")
        verify_resp = await client.post("/auth/verify", json={"token": token})
        access_token = verify_resp.json()["access_token"]

        response = await client.get(
            "/profile",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        # Profile router is still a stub, but it should NOT be 401/403
        assert response.status_code != 401
        assert response.status_code != 403
