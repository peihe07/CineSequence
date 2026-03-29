"""Authentication router: register, verify (magic link), login."""

import hmac
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from slowapi import Limiter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.deps import get_db, get_current_user
from app.models.user import Gender, User
from app.models.waitlist_entry import WaitlistEntry
from app.schemas.auth import (
    AdminQuickLoginRequest,
    LoginResponse,
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    VerifyRequest,
    WaitlistRequest,
    WaitlistResponse,
)
from app.security import get_client_ip, validate_csrf_origin
from app.services.auth_cookies import clear_auth_cookie, set_auth_cookie
from app.services.auth_utils import (
    create_access_token,
    create_magic_link_token,
    email_has_admin_access,
    verify_magic_link_token,
)
from app.services.email_service import send_magic_link

router = APIRouter()
limiter = Limiter(key_func=get_client_ip)


def sync_admin_flag(user: User) -> bool:
    """Sync admin status from the configured allowlist."""
    should_be_admin = email_has_admin_access(user.email)
    if user.is_admin != should_be_admin:
        user.is_admin = should_be_admin
        return True
    return False


REGISTER_SUCCESS_MESSAGE = "If this email is eligible, a magic link has been sent."
LOGIN_UNKNOWN_EMAIL_MESSAGE = "Account not found. Please register first."
LOGIN_MAGIC_LINK_MESSAGE = "A magic link has been sent."
LOGIN_ADMIN_PASSCODE_MESSAGE = "Admin passcode required."
WAITLIST_SUCCESS_MESSAGE = (
    "You're on the waitlist. We're developing new features and performing maintenance. "
    "We'll email you again when access reopens."
)
ADMIN_QUICK_LOGIN_INVALID_MESSAGE = "Invalid admin credentials."


async def get_or_create_admin_user(email: str, db: AsyncSession) -> User:
    """Provision the allowlisted admin account when using quick login."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            email=email,
            name="Admin User",
            gender=Gender.other,
            region="TW",
            birth_year=None,
            is_admin=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    if not user.is_admin:
        user.is_admin = True
        await db.commit()
        await db.refresh(user)
    return user


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
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
        return RegisterResponse(message=REGISTER_SUCCESS_MESSAGE)

    # Create user
    user = User(
        email=body.email,
        name=body.name,
        gender=body.gender,
        region=body.region,
        birth_year=body.birth_year,
        is_admin=email_has_admin_access(body.email),
        agreed_to_terms_at=datetime.now(UTC),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Send magic link
    token, expires_at = create_magic_link_token(body.email)
    user.magic_link_token = token
    user.magic_link_expires_at = expires_at
    await db.commit()

    await send_magic_link(body.email, token, body.next_path)

    return RegisterResponse(message=REGISTER_SUCCESS_MESSAGE)


@router.post("/waitlist", response_model=WaitlistResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def join_waitlist(
    request: Request,
    body: WaitlistRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Add an email to the reopen waitlist."""
    validate_csrf_origin(request)

    result = await db.execute(
        select(WaitlistEntry).where(WaitlistEntry.email == body.email)
    )
    existing = result.scalar_one_or_none()
    if existing is None:
        db.add(WaitlistEntry(email=body.email))
        await db.commit()

    return WaitlistResponse(message=WAITLIST_SUCCESS_MESSAGE)


@router.post("/admin/session", response_model=TokenResponse)
@limiter.limit("5/minute")
async def create_admin_session(
    request: Request,
    response: Response,
    body: AdminQuickLoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a production-capable admin quick-login session using a shared passcode."""
    validate_csrf_origin(request)

    configured_passcode = settings.admin_quick_login_passcode.strip()
    if not configured_passcode:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    if not email_has_admin_access(body.email) or not hmac.compare_digest(
        body.passcode, configured_passcode
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ADMIN_QUICK_LOGIN_INVALID_MESSAGE,
        )

    user = await get_or_create_admin_user(body.email, db)
    access_token = create_access_token(user.id, user.auth_version)
    set_auth_cookie(response, access_token)
    return TokenResponse(access_token=access_token)


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Send a magic link to an existing user, or reject unknown emails."""
    validate_csrf_origin(request)
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=LOGIN_UNKNOWN_EMAIL_MESSAGE,
        )

    if sync_admin_flag(user):
        await db.flush()
    if user.is_admin and settings.admin_quick_login_passcode.strip():
        await db.commit()
        return LoginResponse(
            mode="admin_passcode_required",
            message=LOGIN_ADMIN_PASSCODE_MESSAGE,
        )

    token, expires_at = create_magic_link_token(body.email)
    user.magic_link_token = token
    user.magic_link_expires_at = expires_at
    await db.commit()
    await send_magic_link(body.email, token, body.next_path)

    return LoginResponse(mode="magic_link", message=LOGIN_MAGIC_LINK_MESSAGE)


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
        or user.magic_link_expires_at <= datetime.now(UTC)
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
