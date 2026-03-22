"""Development-only authentication helpers for local E2E and debugging."""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.schemas.dev_auth import DevMagicLinkRequest, DevSessionRequest, MagicLinkResponse
from app.services.auth_cookies import set_auth_cookie
from app.services.auth_utils import create_access_token

router = APIRouter()


@router.post("/session", response_model=TokenResponse)
async def create_dev_session(
    body: DevSessionRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a session for local E2E/dev flows. Disabled in production."""
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
    set_auth_cookie(response, access_token)
    return TokenResponse(access_token=access_token)


@router.post("/magic-link", response_model=MagicLinkResponse)
async def get_dev_magic_link(
    body: DevMagicLinkRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return the active magic-link token for local E2E/dev flows."""
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
