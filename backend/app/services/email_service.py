"""Email service using Resend. Falls back to console logging in development."""

import logging

import resend

from app.config import settings

logger = logging.getLogger(__name__)


def _init_resend() -> None:
    if settings.resend_api_key:
        resend.api_key = settings.resend_api_key


async def send_magic_link(email: str, token: str) -> None:
    """Send a magic link email to the user."""
    verify_url = f"{settings.frontend_url}/verify?token={token}"

    if settings.environment == "development" and not settings.resend_api_key:
        logger.info("=== Magic Link (dev mode) ===")
        logger.info("  To: %s", email)
        logger.info("  URL: %s", verify_url)
        return

    _init_resend()
    resend.Emails.send({
        "from": "Movie DNA <noreply@moviedna.app>",
        "to": [email],
        "subject": "Your Movie DNA login link",
        "html": (
            f"<h2>Welcome to Movie DNA</h2>"
            f"<p>Click the link below to sign in:</p>"
            f'<p><a href="{verify_url}">Sign in to Movie DNA</a></p>'
            f"<p>This link expires in {settings.magic_link_expiry_minutes} minutes.</p>"
        ),
    })
