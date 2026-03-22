"""JWT and magic link token utilities."""

import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7


def create_magic_link_token(email: str) -> tuple[str, datetime]:
    """Create a signed magic link token. Returns (token, expires_at)."""
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.magic_link_expiry_minutes)
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


def create_access_token(user_id: uuid.UUID) -> str:
    """Create a JWT access token for authenticated requests."""
    expires = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "exp": expires,
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> uuid.UUID | None:
    """Decode JWT access token. Returns user_id if valid, None otherwise."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            return None
        user_id_str = payload.get("sub")
        if not user_id_str:
            return None
        return uuid.UUID(user_id_str)
    except (JWTError, ValueError):
        return None
