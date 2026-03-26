from app.config import settings
from app.services.r2_storage import get_public_url, normalize_public_object_url


def test_get_public_url_adds_bucket_for_account_level_r2_domain(monkeypatch):
    monkeypatch.setattr(settings, "s3_bucket", "cinesequence")
    monkeypatch.setattr(
        settings,
        "s3_public_url",
        "https://pub-e41ee8d058234933a2c34e1300b7e2be.r2.dev",
    )

    url = get_public_url("avatars/test.jpg")

    assert url == "https://pub-e41ee8d058234933a2c34e1300b7e2be.r2.dev/cinesequence/avatars/test.jpg"


def test_get_public_url_preserves_existing_bucket_path(monkeypatch):
    monkeypatch.setattr(settings, "s3_bucket", "cinesequence")
    monkeypatch.setattr(
        settings,
        "s3_public_url",
        "https://pub-e41ee8d058234933a2c34e1300b7e2be.r2.dev/cinesequence",
    )

    url = get_public_url("/avatars/test.jpg")

    assert url == "https://pub-e41ee8d058234933a2c34e1300b7e2be.r2.dev/cinesequence/avatars/test.jpg"


def test_normalize_public_object_url_rewrites_legacy_r2_dev_url(monkeypatch):
    monkeypatch.setattr(settings, "s3_bucket", "cinesequence")
    monkeypatch.setattr(
        settings,
        "s3_public_url",
        "https://assets.cinesequence.xyz",
    )

    url = normalize_public_object_url(
        "https://pub-e41ee8d058234933a2c34e1300b7e2be.r2.dev/cinesequence/tickets/test.png"
    )

    assert url == "https://assets.cinesequence.xyz/tickets/test.png"


def test_normalize_public_object_url_preserves_custom_domain_url(monkeypatch):
    monkeypatch.setattr(settings, "s3_bucket", "cinesequence")
    monkeypatch.setattr(
        settings,
        "s3_public_url",
        "https://assets.cinesequence.xyz",
    )

    url = normalize_public_object_url("https://assets.cinesequence.xyz/tickets/test.png")

    assert url == "https://assets.cinesequence.xyz/tickets/test.png"
