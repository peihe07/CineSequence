from app.config import settings
from app.services.email_service import _build_verify_url


def test_build_verify_url_appends_next_path(monkeypatch):
    monkeypatch.setattr(settings, "frontend_url", "https://cinesequence.xyz")

    url = _build_verify_url("abc123", "/profile?tab=bio")

    assert url == "https://cinesequence.xyz/verify?token=abc123&next=/profile?tab=bio"
