from fastapi import Response

from app.config import settings


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        httponly=True,
        secure=settings.resolved_auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        max_age=60 * 60 * 24 * 7,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.auth_cookie_name,
        path="/",
        httponly=True,
        secure=settings.resolved_auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
    )
