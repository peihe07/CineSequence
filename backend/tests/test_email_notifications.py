"""Tests for match email notification flow."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture
def match_id():
    return uuid.uuid4()


@pytest.fixture
def dev_settings():
    mock = MagicMock()
    mock.environment = "development"
    mock.resend_api_key = ""
    mock.frontend_url = "http://localhost:3000"
    return mock


@pytest.fixture
def prod_settings():
    mock = MagicMock()
    mock.environment = "production"
    mock.resend_api_key = "re_test_abc123"
    mock.frontend_url = "https://cinesequence.app"
    return mock


class TestSendOrLog:
    @pytest.mark.asyncio
    async def test_dev_mode_logs_instead_of_sending(self, dev_settings):
        from app.services.email_service import _send_or_log

        with (
            patch("app.services.email_service.settings", dev_settings),
            patch("app.services.email_service.resend") as mock_resend,
            patch("app.services.email_service.logger") as mock_logger,
        ):
            await _send_or_log(to="user@example.com", subject="Test", html="<p>Hi</p>")
            mock_resend.Emails.send.assert_not_called()
            assert mock_logger.info.call_count >= 3

    @pytest.mark.asyncio
    async def test_prod_mode_calls_resend(self, prod_settings):
        from app.services.email_service import _send_or_log

        with (
            patch("app.services.email_service.settings", prod_settings),
            patch("app.services.email_service._resend_initialized", False),
            patch("app.services.email_service.resend") as mock_resend,
        ):
            await _send_or_log(to="user@example.com", subject="Test", html="<p>Hi</p>")
            mock_resend.Emails.send.assert_called_once()
            payload = mock_resend.Emails.send.call_args[0][0]
            assert payload["to"] == ["user@example.com"]
            assert payload["subject"] == "Test"


class TestSendInviteEmail:
    @pytest.mark.asyncio
    async def test_dev_mode_logs_invite(self, dev_settings, match_id):
        from app.services.email_service import send_invite_email

        with (
            patch("app.services.email_service.settings", dev_settings),
            patch("app.services.email_service.resend") as mock_resend,
            patch("app.services.email_service.logger") as mock_logger,
        ):
            await send_invite_email(
                recipient_email="bob@example.com",
                recipient_name="Bob",
                inviter_name="Alice",
                inviter_archetype="時空旅人 Time Traveler",
                shared_tags=["dystopia", "noir"],
                ice_breakers=["你們對「反烏托邦」都有偏好"],
                match_id=match_id,
            )
            mock_resend.Emails.send.assert_not_called()
            assert mock_logger.info.call_count >= 3

    @pytest.mark.asyncio
    async def test_prod_mode_sends_invite(self, prod_settings, match_id):
        from app.services.email_service import send_invite_email

        with (
            patch("app.services.email_service.settings", prod_settings),
            patch("app.services.email_service._resend_initialized", False),
            patch("app.services.email_service.resend") as mock_resend,
        ):
            await send_invite_email(
                recipient_email="bob@example.com",
                recipient_name="Bob",
                inviter_name="Alice",
                inviter_archetype="時空旅人 Time Traveler",
                shared_tags=["dystopia"],
                ice_breakers=["你們對「反烏托邦」都有偏好"],
                match_id=match_id,
            )
            mock_resend.Emails.send.assert_called_once()
            payload = mock_resend.Emails.send.call_args[0][0]
            assert payload["to"] == ["bob@example.com"]
            assert "Alice" in payload["subject"]
            assert "Alice" in payload["html"]

    @pytest.mark.asyncio
    async def test_invite_email_escapes_html(self, prod_settings, match_id):
        from app.services.email_service import send_invite_email

        with (
            patch("app.services.email_service.settings", prod_settings),
            patch("app.services.email_service._resend_initialized", False),
            patch("app.services.email_service.resend") as mock_resend,
        ):
            await send_invite_email(
                recipient_email="bob@example.com",
                recipient_name="Bob",
                inviter_name='<script>alert("xss")</script>',
                inviter_archetype='<img src=x onerror=alert(1)>',
                shared_tags=[],
                ice_breakers=[],
                match_id=match_id,
            )
            html = mock_resend.Emails.send.call_args[0][0]["html"]
            assert "<script>" not in html
            assert "&lt;script&gt;" in html

    @pytest.mark.asyncio
    async def test_invite_truncates_tags_and_breakers(self, prod_settings, match_id):
        from app.services.email_service import send_invite_email

        with (
            patch("app.services.email_service.settings", prod_settings),
            patch("app.services.email_service._resend_initialized", False),
            patch("app.services.email_service.resend") as mock_resend,
        ):
            await send_invite_email(
                recipient_email="bob@example.com",
                recipient_name="Bob",
                inviter_name="Alice",
                inviter_archetype="Type",
                shared_tags=[f"tag_{i}" for i in range(10)],
                ice_breakers=[f"breaker_{i}" for i in range(6)],
                match_id=match_id,
            )
            html = mock_resend.Emails.send.call_args[0][0]["html"]
            assert "tag_4" in html
            assert "tag_5" not in html
            assert "breaker_2" in html
            assert "breaker_3" not in html


class TestSendMatchAcceptedEmail:
    @pytest.mark.asyncio
    async def test_dev_mode_logs_accepted(self, dev_settings, match_id):
        from app.services.email_service import send_match_accepted_email

        with (
            patch("app.services.email_service.settings", dev_settings),
            patch("app.services.email_service.resend") as mock_resend,
            patch("app.services.email_service.logger"),
        ):
            await send_match_accepted_email(
                to_email="alice@example.com",
                to_name="Alice",
                partner_name="Bob",
                partner_archetype="黑暗詩人 Dark Poet",
                shared_tags=["noir"],
                ice_breakers=["聊聊 noir"],
                match_id=match_id,
            )
            mock_resend.Emails.send.assert_not_called()

    @pytest.mark.asyncio
    async def test_prod_mode_sends_accepted(self, prod_settings, match_id):
        from app.services.email_service import send_match_accepted_email

        with (
            patch("app.services.email_service.settings", prod_settings),
            patch("app.services.email_service._resend_initialized", False),
            patch("app.services.email_service.resend") as mock_resend,
        ):
            await send_match_accepted_email(
                to_email="alice@example.com",
                to_name="Alice",
                partner_name="Bob",
                partner_archetype="黑暗詩人 Dark Poet",
                shared_tags=["noir"],
                ice_breakers=["聊聊 noir"],
                match_id=match_id,
            )
            payload = mock_resend.Emails.send.call_args[0][0]
            assert payload["to"] == ["alice@example.com"]
            assert "Bob" in payload["subject"]
            assert "配對確認" in payload["subject"]

    @pytest.mark.asyncio
    async def test_accepted_email_contains_match_url(self, prod_settings, match_id):
        from app.services.email_service import send_match_accepted_email

        with (
            patch("app.services.email_service.settings", prod_settings),
            patch("app.services.email_service._resend_initialized", False),
            patch("app.services.email_service.resend") as mock_resend,
        ):
            await send_match_accepted_email(
                to_email="alice@example.com",
                to_name="Alice",
                partner_name="Bob",
                partner_archetype="Type",
                shared_tags=[],
                ice_breakers=[],
                match_id=match_id,
            )
            html = mock_resend.Emails.send.call_args[0][0]["html"]
            assert f"matches?match={match_id}" in html


class TestGetArchetypeName:
    def test_returns_fallback_when_no_dna_profile(self):
        from app.services.matcher import _get_archetype_name

        mock_user = MagicMock()
        mock_user.dna_profile = None
        assert _get_archetype_name(mock_user) == "電影愛好者"

    def test_returns_fallback_for_unknown_archetype(self):
        from app.services.matcher import _get_archetype_name

        mock_profile = MagicMock()
        mock_profile.archetype_id = "nonexistent_xyz"
        mock_user = MagicMock()
        mock_user.dna_profile = mock_profile
        assert _get_archetype_name(mock_user) == "電影愛好者"

    def test_returns_correct_archetype_name(self):
        from app.services.matcher import _get_archetype_name, ARCHETYPE_MAP

        archetype_id = next(iter(ARCHETYPE_MAP))
        data = ARCHETYPE_MAP[archetype_id]

        mock_profile = MagicMock()
        mock_profile.archetype_id = archetype_id
        mock_user = MagicMock()
        mock_user.dna_profile = mock_profile

        result = _get_archetype_name(mock_user)
        assert result == f"{data['name']} {data['name_en']}"
