import pytest
from pydantic import ValidationError

from app.schemas.auth import LoginRequest, RegisterRequest


def test_login_request_accepts_relative_next_path():
    payload = LoginRequest(email="user@test.com", next_path="/profile?tab=bio")
    assert payload.next_path == "/profile?tab=bio"


def test_login_request_rejects_external_next_path():
    with pytest.raises(ValidationError):
        LoginRequest(email="user@test.com", next_path="https://evil.example")


def test_register_request_rejects_scheme_relative_next_path():
    with pytest.raises(ValidationError):
        RegisterRequest(
            email="user@test.com",
            name="User",
            gender="other",
            region="TW",
            birth_year=1990,
            agreed_to_terms=True,
            next_path="//evil.example",
        )
