"""Email service using Resend. Falls back to console logging in development."""

import asyncio
import html as html_mod
import logging
import uuid

import resend

from app.config import settings

logger = logging.getLogger(__name__)

SENDER = "Cine Sequence <noreply@cinesequence.xyz>"

_resend_initialized = False


def _init_resend() -> None:
    global _resend_initialized
    if _resend_initialized:
        return
    if settings.resend_api_key:
        resend.api_key = settings.resend_api_key
        _resend_initialized = True


def _esc(value: str) -> str:
    """Escape user-supplied values for safe HTML embedding."""
    return html_mod.escape(value, quote=True)


async def _send_or_log(to: str, subject: str, html: str) -> None:
    """Send email via Resend (in thread executor), or log to console in dev mode."""
    if settings.environment == "development" and not settings.resend_api_key:
        logger.info("=== Email (dev mode) ===")
        logger.info("  To: %s", to)
        logger.info("  Subject: %s", subject)
        logger.info("  Body:\n%s", html)
        return

    _init_resend()
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, lambda: resend.Emails.send({
        "from": SENDER,
        "to": [to],
        "subject": subject,
        "html": html,
    }))


async def send_magic_link(email: str, token: str) -> None:
    """Send a magic link email to the user."""
    verify_url = f"{settings.frontend_url}/verify?token={token}"
    await _send_or_log(
        to=email,
        subject="Your Cine Sequence login link",
        html=(
            f"<h2>Welcome to Cine Sequence</h2>"
            f"<p>Click the link below to sign in:</p>"
            f'<p><a href="{verify_url}">Sign in to Cine Sequence</a></p>'
            f"<p>This link expires in {settings.magic_link_expiry_minutes} minutes.</p>"
        ),
    )


async def send_invite_email(
    recipient_email: str,
    recipient_name: str,
    inviter_name: str,
    inviter_archetype: str,
    shared_tags: list[str],
    ice_breakers: list[str],
    match_id: uuid.UUID,
) -> None:
    """Send notification email when someone sends a match invite."""
    respond_url = f"{settings.frontend_url}/matches?respond={match_id}"
    safe_inviter = _esc(inviter_name)
    safe_archetype = _esc(inviter_archetype)

    tags_html = ""
    if shared_tags:
        tags_list = " · ".join(_esc(t) for t in shared_tags[:5])
        tags_html = f'<p style="color:#888;font-size:13px;">共同品味：{tags_list}</p>'

    breakers_html = ""
    if ice_breakers:
        items = "".join(f"<li>{_esc(b)}</li>" for b in ice_breakers[:3])
        breakers_html = (
            f'<p style="font-size:13px;color:#888;">可聊的方向：</p>'
            f'<ul style="font-size:13px;color:#666;">{items}</ul>'
        )

    await _send_or_log(
        to=recipient_email,
        subject=f"來自 {inviter_name} 的配對邀請 — Cine Sequence",
        html=(
            f"<h2>一位觀影者對你的品味產生了共鳴</h2>"
            f"<p><strong>{safe_inviter}</strong>（{safe_archetype}）"
            f"向你發出了配對邀請。</p>"
            f"{tags_html}"
            f"{breakers_html}"
            f'<p><a href="{respond_url}" '
            f'style="display:inline-block;padding:10px 24px;'
            f"background:#c06223;color:#fff;text-decoration:none;"
            f'font-family:monospace;">查看並回應</a></p>'
            f'<p style="font-size:12px;color:#aaa;">'
            f"你可以選擇接受或婉拒，你的聯絡資訊不會被透露。</p>"
        ),
    )


async def send_match_accepted_email(
    to_email: str,
    to_name: str,
    partner_name: str,
    partner_archetype: str,
    shared_tags: list[str],
    ice_breakers: list[str],
    match_id: uuid.UUID,
) -> None:
    """Send notification email when a match is accepted (sent to both parties)."""
    match_url = f"{settings.frontend_url}/ticket?inviteId={match_id}"
    safe_partner = _esc(partner_name)
    safe_archetype = _esc(partner_archetype)

    tags_html = ""
    if shared_tags:
        tags_list = " · ".join(_esc(t) for t in shared_tags[:5])
        tags_html = f'<p style="color:#888;font-size:13px;">你們的共同品味：{tags_list}</p>'

    breakers_html = ""
    if ice_breakers:
        items = "".join(f"<li>{_esc(b)}</li>" for b in ice_breakers[:3])
        breakers_html = (
            f'<p style="font-size:13px;color:#888;">對話方向：</p>'
            f'<ul style="font-size:13px;color:#666;">{items}</ul>'
        )

    await _send_or_log(
        to=to_email,
        subject=f"配對確認 — 你與 {partner_name} — Cine Sequence",
        html=(
            f"<h2>配對已建立</h2>"
            f"<p>你與 <strong>{safe_partner}</strong>（{safe_archetype}）"
            f"的配對已確認。</p>"
            f"{tags_html}"
            f"{breakers_html}"
            f'<p><a href="{match_url}" '
            f'style="display:inline-block;padding:10px 24px;'
            f"background:#c06223;color:#fff;text-decoration:none;"
            f'font-family:monospace;">開始對話</a></p>'
            f'<p style="font-size:12px;color:#aaa;">'
            f"所有對話透過 Cine Sequence 進行，你的隱私受到保護。</p>"
        ),
    )
