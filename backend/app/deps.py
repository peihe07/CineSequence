from collections.abc import AsyncGenerator
from typing import Annotated

import redis.asyncio as aioredis
from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.security import validate_csrf_origin

engine = create_async_engine(settings.database_url, echo=settings.environment == "development")
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)

security = HTTPBearer(auto_error=False)


async def get_db() -> AsyncGenerator[AsyncSession]:
    async with async_session() as session:
        yield session


async def get_redis() -> aioredis.Redis:
    return redis_client


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
    session_token: Annotated[str | None, Cookie(alias=settings.auth_cookie_name)] = None,
):
    """Extract and validate session auth, return the authenticated User."""
    from app.models.user import User
    from app.services.auth_utils import decode_access_token

    raw_token = credentials.credentials if credentials else session_token
    if raw_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    if session_token is not None and request.method in {"POST", "PATCH", "PUT", "DELETE"}:
        validate_csrf_origin(request)

    decoded = decode_access_token(raw_token)
    if decoded is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    user_id, token_auth_version = decoded

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if user.auth_version != token_auth_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    return user
