"""Authentication router: register, verify (magic link), login."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse, VerifyRequest
from app.services.auth_utils import create_access_token, create_magic_link_token, verify_magic_link_token
from app.services.email_service import send_magic_link

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Register a new user and send a magic link email."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == body.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

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
async def login(
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Send a magic link to an existing user."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email not found",
        )

    token, expires_at = create_magic_link_token(body.email)
    user.magic_link_token = token
    user.magic_link_expires_at = expires_at
    await db.commit()

    await send_magic_link(body.email, token)

    return {"message": "Magic link sent to your email"}


@router.post("/verify", response_model=TokenResponse)
async def verify(
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

    # Invalidate the magic link token after use
    user.magic_link_token = None
    user.magic_link_expires_at = None
    await db.commit()

    access_token = create_access_token(user.id)
    return TokenResponse(access_token=access_token)
