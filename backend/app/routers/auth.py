"""Authentication router: register, verify (magic link), login."""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.deps import get_db
from app.models.user import User
from app.schemas.auth import (
    DevMagicLinkRequest,
    DevSessionRequest,
    LoginRequest,
    MagicLinkResponse,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    VerifyRequest,
)
from app.services.auth_utils import create_access_token, create_magic_link_token, verify_magic_link_token
from app.services.email_service import send_magic_link

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        httponly=True,
        secure=settings.environment != "development",
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.auth_cookie_name,
        path="/",
        httponly=True,
        secure=settings.environment != "development",
        samesite="lax",
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Register a new user and send a magic link email."""
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
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    # Always return same message to prevent user enumeration
    if user:
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

    # Invalidate the magic link token after use
    user.magic_link_token = None
    user.magic_link_expires_at = None
    await db.commit()

    access_token = create_access_token(user.id)
    _set_auth_cookie(response, access_token)
    return TokenResponse(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response):
    """Clear the session cookie."""
    _clear_auth_cookie(response)


@router.post("/dev/session", response_model=TokenResponse)
async def create_dev_session(
    body: DevSessionRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a session for local E2E/dev flows. Disabled in production."""
    if settings.environment == "production":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            email=body.email,
            name=body.name,
            gender=body.gender,
            region=body.region,
            birth_year=body.birth_year,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    access_token = create_access_token(user.id)
    _set_auth_cookie(response, access_token)
    return TokenResponse(access_token=access_token)


@router.post("/dev/magic-link", response_model=MagicLinkResponse)
async def get_dev_magic_link(
    body: DevMagicLinkRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return the active magic-link token for local E2E/dev flows. Disabled in production."""
    if settings.environment == "production":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user is None or user.magic_link_token is None or user.magic_link_expires_at is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Magic link not found",
        )
    if user.magic_link_expires_at <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Magic link expired",
        )

    return MagicLinkResponse(token=user.magic_link_token)
