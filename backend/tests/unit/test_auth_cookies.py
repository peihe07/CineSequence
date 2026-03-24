from fastapi import Response

from app.config import settings
from app.services.auth_cookies import clear_auth_cookie, set_auth_cookie


def test_auth_cookie_secure_defaults_off_in_test_environment(monkeypatch):
    monkeypatch.setattr(settings, "environment", "test")
    monkeypatch.setattr(settings, "auth_cookie_secure", None)

    assert settings.resolved_auth_cookie_secure is False


def test_auth_cookies_include_configured_domain(monkeypatch):
    monkeypatch.setattr(settings, "auth_cookie_domain", ".cinesequence.xyz")
    monkeypatch.setattr(settings, "auth_cookie_secure", True)

    response = Response()
    set_auth_cookie(response, "token-123")

    header = response.headers["set-cookie"]
    assert "Domain=.cinesequence.xyz" in header
    assert "HttpOnly" in header
    assert "Secure" in header

    clear_auth_cookie(response)
    cleared = response.headers.getlist("set-cookie")[-1]
    assert "Domain=.cinesequence.xyz" in cleared
    assert "Max-Age=0" in cleared
