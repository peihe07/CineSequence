"""Authentication router: register, verify (magic link), login."""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    VerifyRequest,
)
from app.security import validate_csrf_origin
from app.services.auth_cookies import clear_auth_cookie, set_auth_cookie
from app.services.auth_utils import (
    create_access_token,
    create_magic_link_token,
    email_has_admin_access,
    verify_magic_link_token,
)
from app.services.email_service import send_magic_link

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


def sync_admin_flag(user: User) -> bool:
    """Sync admin status from the configured allowlist."""
    should_be_admin = email_has_admin_access(user.email)
    if user.is_admin != should_be_admin:
        user.is_admin = should_be_admin
        return True
    return False


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Register a new user and send a magic link email."""
    validate_csrf_origin(request)
    if not body.agreed_to_terms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must agree to the privacy policy",
        )

    # Check if email already exists
    result = await db.execute(select(User).where(User.email == body.email))
    existing = result.scalar_one_or_none()
    if existing:
        # Return generic message to prevent user enumeration
        return existing

    # Create user
    user = User(
        email=body.email,
        name=body.name,
        gender=body.gender,
        region=body.region,
        birth_year=body.birth_year,
        is_admin=email_has_admin_access(body.email),
        agreed_to_terms_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Send magic link
    token, expires_at = create_magic_link_token(body.email)
    user.magic_link_token = token
    user.magic_link_expires_at = expires_at
    await db.commit()

    await send_magic_link(body.email, token)

    return user


@router.post("/login")
@limiter.limit("5/minute")
async def login(
    request: Request,
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Send a magic link to an existing user."""
    validate_csrf_origin(request)
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    # Always return same message to prevent user enumeration
    if user:
        if sync_admin_flag(user):
            await db.flush()
        token, expires_at = create_magic_link_token(body.email)
        user.magic_link_token = token
        user.magic_link_expires_at = expires_at
        await db.commit()
        await send_magic_link(body.email, token)

    return {"message": "If this email is registered, a magic link has been sent."}


@router.post("/verify", response_model=TokenResponse)
@limiter.limit("10/minute")
async def verify(
    request: Request,
    response: Response,
    body: VerifyRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Verify a magic link token and return a JWT access token."""
    validate_csrf_origin(request)
    email = verify_magic_link_token(body.token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired magic link",
        )

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    if user.magic_link_token != body.token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired magic link",
        )
    if (
        user.magic_link_expires_at is None
        or user.magic_link_expires_at <= datetime.now(timezone.utc)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired magic link",
        )

    sync_admin_flag(user)

    # Invalidate the magic link token after use
    user.magic_link_token = None
    user.magic_link_expires_at = None
    await db.commit()

    access_token = create_access_token(user.id, user.auth_version)
    set_auth_cookie(response, access_token)
    return TokenResponse(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Clear the session cookie."""
    validate_csrf_origin(request)
    # Bump token version so previously issued JWTs are no longer valid.
    # Cookie clearing alone is not enough if a token has already leaked.
    user.auth_version += 1
    await db.commit()
    clear_auth_cookie(response)
