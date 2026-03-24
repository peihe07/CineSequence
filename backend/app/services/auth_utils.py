"""JWT and magic link token utilities."""

import uuid
from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt

from app.config import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7


def email_has_admin_access(email: str) -> bool:
    """Return whether the email is in the configured admin allowlist."""
    return email.strip().lower() in settings.admin_email_set


def create_magic_link_token(email: str) -> tuple[str, datetime]:
    """Create a signed magic link token. Returns (token, expires_at)."""
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.magic_link_expiry_minutes)
    payload = {
        "sub": email,
        "exp": expires_at,
        "jti": str(uuid.uuid4()),
        "type": "magic_link",
    }
    token = jwt.encode(payload, settings.magic_link_secret, algorithm=ALGORITHM)
    return token, expires_at


def verify_magic_link_token(token: str) -> str | None:
    """Verify magic link token. Returns email if valid, None otherwise."""
    try:
        payload = jwt.decode(token, settings.magic_link_secret, algorithms=[ALGORITHM])
        if payload.get("type") != "magic_link":
            return None
        return payload.get("sub")
    except JWTError:
        return None


def create_access_token(user_id: uuid.UUID, auth_version: int) -> str:
    """Create a JWT access token for authenticated requests."""
    expires = datetime.now(UTC) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "exp": expires,
        "type": "access",
        "ver": auth_version,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> tuple[uuid.UUID, int] | None:
    """Decode JWT access token. Returns (user_id, auth_version) if valid, None otherwise."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            return None
        user_id_str = payload.get("sub")
        auth_version = payload.get("ver")
        if not user_id_str or not isinstance(auth_version, int):
            return None
        return uuid.UUID(user_id_str), auth_version
    except (JWTError, ValueError):
        return None
