"""Email service using Resend. Falls back to console logging in development."""

import asyncio
import html as html_mod
import logging
import uuid
from typing import Any
from urllib.parse import quote

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


def _build_verify_url(token: str, next_path: str | None = None) -> str:
    verify_url = f"{settings.frontend_url}/verify?token={quote(token)}"
    if next_path:
        verify_url += f"&next={quote(next_path, safe='/?=&')}"
    return verify_url


async def send_magic_link(email: str, token: str, next_path: str | None = None) -> None:
    """Send a magic link email to the user."""
    verify_url = _build_verify_url(token, next_path)
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
    reminder_number: int = 0,
) -> None:
    """Send notification email when someone sends a match invite."""
    respond_url = f"{settings.frontend_url}/matches?respond={match_id}"
    safe_inviter = _esc(inviter_name)
    safe_archetype = _esc(inviter_archetype)
    is_reminder = reminder_number > 0

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
    invite_copy = (
        "先前向你發出了配對邀請，仍在等你回應。"
        if is_reminder
        else "向你發出了配對邀請。"
    )

    await _send_or_log(
        to=recipient_email,
        subject=(
            f"提醒：{inviter_name} 的配對邀請仍在等你回應 — Cine Sequence"
            if is_reminder
            else f"來自 {inviter_name} 的配對邀請 — Cine Sequence"
        ),
        html=(
            f"<h2>{'配對邀請提醒' if is_reminder else '一位觀影者對你的品味產生了共鳴'}</h2>"
            f"<p><strong>{safe_inviter}</strong>（{safe_archetype}）"
            f"{invite_copy}</p>"
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
    ticket_image_url: str | None = None,
) -> None:
    """Send notification email when a match is accepted (sent to both parties)."""
    match_url = f"{settings.frontend_url}/ticket?inviteId={match_id}"
    safe_partner = _esc(partner_name)
    safe_archetype = _esc(partner_archetype)

    ticket_html = ""
    if ticket_image_url:
        ticket_html = (
            f'<div style="margin:20px 0;text-align:center;">'
            f'<img src="{ticket_image_url}" alt="Match Ticket" '
            f'style="max-width:100%;width:600px;border-radius:8px;'
            f'box-shadow:0 4px 12px rgba(0,0,0,0.15);" />'
            f"</div>"
        )

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
            f"{ticket_html}"
            f"{tags_html}"
            f"{breakers_html}"
            f'<p><a href="{match_url}" '
            f'style="display:inline-block;padding:10px 24px;'
            f"background:#c06223;color:#fff;text-decoration:none;"
            f'font-family:monospace;">查看完整票券</a></p>'
            f'<p style="font-size:12px;color:#aaa;">'
            f"所有對話透過 Cine Sequence 進行，你的隱私受到保護。</p>"
        ),
    )


async def send_announcement_email(
    to_email: str,
    subject_zh: str,
    subject_en: str,
    body_sections: list[dict[str, Any]],
    closing_zh: str = "",
    closing_en: str = "",
) -> None:
    """Send a system announcement email.

    body_sections: list of {"title_zh", "title_en", "body_zh", "body_en"} dicts.
    Each section renders as a titled block.
    """
    sections_html = ""
    for sec in body_sections:
        title = _esc(sec.get("title_zh", ""))
        body = _esc(sec.get("body_zh", "")).replace("\n", "<br>")
        sections_html += (
            f'<div style="margin-bottom:20px;">'
            f'<h3 style="margin:0 0 6px;font-size:15px;color:#e0e0e0;">{title}</h3>'
            f'<p style="margin:0;font-size:13px;color:#999;line-height:1.7;">{body}</p>'
            f"</div>"
        )

    closing_html = ""
    if closing_zh:
        closing_html = (
            f'<p style="font-size:12px;color:#777;margin-top:24px;'
            f'border-top:1px solid #333;padding-top:16px;">'
            f"{_esc(closing_zh)}</p>"
        )

    login_url = f"{settings.frontend_url}/login"

    await _send_or_log(
        to=to_email,
        subject=f"{subject_zh} — Cine Sequence",
        html=(
            f'<div style="max-width:560px;margin:0 auto;font-family:'
            f"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
            f'color:#ddd;background:#111;padding:32px 28px;border-radius:12px;">'
            f'<h2 style="margin:0 0 24px;font-size:18px;color:#fff;'
            f'font-weight:600;">{_esc(subject_zh)}</h2>'
            f"{sections_html}"
            f'<p><a href="{login_url}" '
            f'style="display:inline-block;padding:10px 24px;margin-top:8px;'
            f"background:#c06223;color:#fff;text-decoration:none;"
            f'font-family:monospace;border-radius:6px;">登入 Cine Sequence</a></p>'
            f"{closing_html}"
            f"</div>"
        ),
    )
