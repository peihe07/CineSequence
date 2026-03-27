"""Ticket generation service: render HTML ticket to PNG via Playwright."""

import json
import logging
import uuid
from html import escape
from pathlib import Path

from app.config import settings
from app.services.r2_storage import upload_bytes

logger = logging.getLogger(__name__)

_data_dir = Path(__file__).parent.parent / "data"
_taxonomy = json.loads((_data_dir / "tag_taxonomy.json").read_text())
_fonts_dir = Path(__file__).parent.parent / "fonts"

_TAG_ZH_LABELS = {
    "twist": "反轉結局",
    "mindfuck": "燒腦",
    "slowburn": "慢熱",
    "ensemble": "群戲",
    "solo": "獨角戲",
    "visualFeast": "視覺饗宴",
    "dialogue": "對白精彩",
    "tearjerker": "催淚",
    "darkTone": "黑暗",
    "uplifting": "正能量",
    "philosophical": "哲學思辨",
    "satirical": "社會諷刺",
    "nostalgic": "懷舊",
    "experimental": "實驗性",
    "cult": "邪典",
    "comingOfAge": "成長故事",
    "revenge": "復仇",
    "heist": "精密計畫",
    "survival": "生存掙扎",
    "timeTravel": "時空穿越",
    "dystopia": "反烏托邦",
    "trueStory": "真實事件",
    "nonEnglish": "非英語",
    "existential": "存在主義",
    "antiHero": "反英雄",
    "romanticCore": "浪漫內核",
    "violentAesthetic": "暴力美學",
    "socialCritique": "社會批判",
    "psychoThriller": "心理驚悚",
    "absurdist": "荒誕",
}

# 票券寬度固定，高度由內容撐開
TICKET_W = 900

# 各風格的色彩（深色系 glassmorphism）
STYLE_PALETTES = {
    "scifi": {
        "bg_from": "rgba(15, 23, 42, 0.97)",
        "bg_to": "rgba(8, 14, 30, 0.95)",
        "accent": "rgb(56, 189, 248)",
        "accent_alpha": "rgba(56, 189, 248, {})",
        "text": "rgba(226, 232, 240, 0.95)",
        "muted": "rgba(100, 116, 139, 0.7)",
        "stripe": "rgba(56, 189, 248, 0.72)",
        "stripe_end": "rgba(56, 189, 248, 0.08)",
    },
    "noir": {
        "bg_from": "rgba(24, 24, 27, 0.97)",
        "bg_to": "rgba(17, 18, 21, 0.95)",
        "accent": "rgb(239, 68, 68)",
        "accent_alpha": "rgba(239, 68, 68, {})",
        "text": "rgba(228, 228, 231, 0.95)",
        "muted": "rgba(113, 113, 122, 0.7)",
        "stripe": "rgba(239, 68, 68, 0.72)",
        "stripe_end": "rgba(239, 68, 68, 0.08)",
    },
    "classic": {
        "bg_from": "rgba(42, 36, 28, 0.97)",
        "bg_to": "rgba(32, 27, 20, 0.95)",
        "accent": "rgb(217, 152, 89)",
        "accent_alpha": "rgba(217, 152, 89, {})",
        "text": "rgba(240, 233, 224, 0.95)",
        "muted": "rgba(168, 162, 158, 0.6)",
        "stripe": "rgba(217, 152, 89, 0.72)",
        "stripe_end": "rgba(217, 152, 89, 0.08)",
    },
    "indie": {
        "bg_from": "rgba(22, 28, 24, 0.97)",
        "bg_to": "rgba(14, 20, 16, 0.95)",
        "accent": "rgb(74, 222, 128)",
        "accent_alpha": "rgba(74, 222, 128, {})",
        "text": "rgba(220, 230, 224, 0.95)",
        "muted": "rgba(138, 145, 137, 0.6)",
        "stripe": "rgba(74, 222, 128, 0.72)",
        "stripe_end": "rgba(74, 222, 128, 0.08)",
    },
    "action": {
        "bg_from": "rgba(30, 27, 24, 0.97)",
        "bg_to": "rgba(17, 15, 13, 0.95)",
        "accent": "rgb(249, 115, 22)",
        "accent_alpha": "rgba(249, 115, 22, {})",
        "text": "rgba(231, 229, 228, 0.95)",
        "muted": "rgba(120, 113, 108, 0.6)",
        "stripe": "rgba(249, 115, 22, 0.72)",
        "stripe_end": "rgba(249, 115, 22, 0.08)",
    },
}


def _get_tag_label(tag_key: str) -> str:
    return _TAG_ZH_LABELS.get(
        tag_key,
        _taxonomy["tags"].get(tag_key, {}).get("zh", tag_key),
    )


def _encode_font_base64(path: Path) -> str | None:
    """Read a font file and return its base64-encoded data URI."""
    if not path.exists():
        return None
    import base64
    data = path.read_bytes()
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:font/truetype;base64,{b64}"


# 啟動時預載字型，避免每次都讀檔
_FONT_DATA_URIS: dict[str, str | None] = {}


def _get_font_data_uri(weight: str) -> str | None:
    if weight not in _FONT_DATA_URIS:
        path = _fonts_dir / f"NotoSansTC-{'Bold' if weight == '700' else 'Regular'}.ttf"
        _FONT_DATA_URIS[weight] = _encode_font_base64(path)
    return _FONT_DATA_URIS[weight]


def _build_font_face_css() -> str:
    """Build @font-face CSS with base64-embedded fonts."""
    css = ""
    regular_uri = _get_font_data_uri("400")
    if regular_uri:
        css += f"""
@font-face {{
  font-family: 'Noto Sans TC';
  src: url('{regular_uri}') format('truetype');
  font-weight: 400;
  font-style: normal;
}}"""
    bold_uri = _get_font_data_uri("700")
    if bold_uri:
        css += f"""
@font-face {{
  font-family: 'Noto Sans TC';
  src: url('{bold_uri}') format('truetype');
  font-weight: 700;
  font-style: normal;
}}"""
    return css


def _build_ticket_html(
    name: str,
    email: str,
    archetype: str,
    top_tags: list[str],
    top_genres: list[str],
    bio: str | None = None,
    ticket_style: str = "classic",
    avatar_url: str | None = None,
    favorite_movies: list[str] | None = None,
) -> str:
    """Build self-contained HTML for the ticket card."""
    palette = STYLE_PALETTES.get(ticket_style, STYLE_PALETTES["classic"])
    favorite_movies = favorite_movies or []
    serial = f"#{uuid.uuid4().hex[:8].upper()}"

    font_face_css = _build_font_face_css()

    tags_html = ""
    for tag_key in top_tags[:8]:
        label = escape(_get_tag_label(tag_key))
        tags_html += f'<span class="tag">{label}</span>\n'

    favorites_html = ""
    for movie in favorite_movies[:3]:
        favorites_html += f'<span class="favorite">· {escape(movie)}</span>\n'

    avatar_html = ""
    if avatar_url:
        avatar_html = f'<img src="{escape(avatar_url)}" alt="" class="avatar" />'

    bio_html = ""
    if bio:
        bio_html = f'<p class="bio">{escape(bio)}</p>'

    genres_html = ""
    if top_genres:
        genre_labels = " / ".join(escape(g) for g in top_genres[:5])
        genres_html = f'<p class="genres">{genre_labels}</p>'

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
{font_face_css}

* {{
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}}

body {{
  width: {TICKET_W}px;
  background: transparent;
  font-family: 'Noto Sans TC', -apple-system, 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
}}

.ticket {{
  position: relative;
  width: {TICKET_W}px;
  display: flex;
  flex-direction: column;
  background:
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 3px,
      rgba(255, 255, 255, 0.012) 3px,
      rgba(255, 255, 255, 0.012) 4px
    ),
    linear-gradient(135deg, {palette['bg_from']}, {palette['bg_to']});
  border-radius: 24px;
  overflow: hidden;
  color: {palette['text']};
}}

/* 頂部 accent 橫線 */
.ticket::before {{
  content: '';
  position: absolute;
  top: 0;
  left: 32px;
  right: 32px;
  height: 2px;
  background: linear-gradient(90deg, {palette['stripe']}, {palette['stripe_end']});
  border-radius: 2px;
}}

/* 微光暈 */
.ticket::after {{
  content: '';
  position: absolute;
  top: -80px;
  right: -40px;
  width: 240px;
  height: 240px;
  background: radial-gradient(circle, {palette['accent_alpha'].format('0.05')}, transparent 70%);
  pointer-events: none;
}}

.header {{
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 28px 0 28px;
}}

.brand {{
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  color: {palette['accent_alpha'].format('0.76')};
}}

.catalog-no {{
  font-size: 9px;
  letter-spacing: 0.16em;
  color: {palette['muted']};
}}

.body {{
  display: flex;
  flex: 1;
  gap: 0;
  padding: 12px 28px 0 28px;
  overflow: hidden;
}}

/* 左欄：身份 */
.left {{
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding-right: 24px;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
}}

.identity-row {{
  display: flex;
  align-items: flex-start;
  gap: 14px;
}}

.identity-copy {{
  flex: 1;
  min-width: 0;
}}

.name {{
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: {palette['text']};
  margin-bottom: 4px;
}}

.archetype {{
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: {palette['muted']};
  margin-bottom: 6px;
}}

.email {{
  font-size: 11px;
  color: {palette['accent_alpha'].format('0.72')};
  margin-bottom: 4px;
}}

.genres {{
  font-size: 10px;
  letter-spacing: 0.04em;
  color: {palette['muted']};
}}

.bio {{
  font-size: 12px;
  line-height: 1.6;
  color: {palette['text'].replace('0.95', '0.6')};
  margin-top: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}}

.avatar {{
  width: 72px;
  height: 72px;
  border-radius: 16px;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}}

/* 右欄：tags + favorites */
.right {{
  width: 310px;
  flex-shrink: 0;
  padding-left: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}}

.section-label {{
  display: block;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: {palette['muted']};
  margin-bottom: 8px;
}}

.tags {{
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}}

.tag {{
  display: inline-block;
  padding: 3px 10px;
  font-size: 12px;
  color: {palette['accent_alpha'].format('0.88')};
  background: {palette['accent_alpha'].format('0.10')};
  border: 1px solid {palette['accent_alpha'].format('0.16')};
  border-radius: 999px;
}}

.favorites {{
  display: flex;
  flex-direction: column;
  gap: 3px;
}}

.favorite {{
  font-size: 12px;
  line-height: 1.5;
  color: {palette['text'].replace('0.95', '0.72')};
}}

.footer {{
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 28px 16px 28px;
  font-size: 9px;
  letter-spacing: 0.14em;
  color: {palette['muted']};
}}

</style>
</head>
<body>
  <div class="ticket">
    <div class="header">
      <span class="brand">CINE SEQUENCE</span>
      <span class="catalog-no">PERSONAL DOSSIER</span>
    </div>

    <div class="body">
      <div class="left">
        <div class="identity-row">
          {avatar_html}
          <div class="identity-copy">
            <h2 class="name">{escape(name)}</h2>
            <p class="archetype">{escape(archetype)}</p>
            <p class="email">{escape(email)}</p>
            {genres_html}
          </div>
        </div>
        {bio_html}
      </div>

      <div class="right">
        {f'''<div>
          <span class="section-label">TASTE TAGS</span>
          <div class="tags">{tags_html}</div>
        </div>''' if top_tags else ''}

        {f'''<div>
          <span class="section-label">MUST-WATCH FILMS</span>
          <div class="favorites">{favorites_html}</div>
        </div>''' if favorite_movies else ''}
      </div>
    </div>

    <div class="footer">
      <span>cinesequence.app</span>
      <span>{serial}</span>
    </div>
  </div>
</body>
</html>"""


async def generate_personal_ticket(
    name: str,
    email: str,
    archetype: str,
    top_tags: list[str],
    top_genres: list[str],
    bio: str | None = None,
    personality_reading: str | None = None,
    conversation_style: str | None = None,
    ticket_style: str = "classic",
    avatar_url: str | None = None,
    favorite_movies: list[str] | None = None,
) -> bytes:
    """Generate a personal movie ID card as PNG via Playwright.

    Returns PNG image as bytes.
    """
    from playwright.async_api import async_playwright

    html = _build_ticket_html(
        name=name,
        email=email,
        archetype=archetype,
        top_tags=top_tags,
        top_genres=top_genres,
        bio=bio,
        ticket_style=ticket_style,
        avatar_url=avatar_url,
        favorite_movies=favorite_movies,
    )

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(
            viewport={"width": TICKET_W, "height": 800},
            device_scale_factor=2,
        )
        await page.set_content(html, wait_until="networkidle")
        # 取得實際內容高度
        ticket_height = await page.evaluate(
            "document.querySelector('.ticket').offsetHeight"
        )
        screenshot = await page.screenshot(
            type="png",
            clip={"x": 0, "y": 0, "width": TICKET_W, "height": ticket_height},
            omit_background=True,
        )
        await browser.close()

    return screenshot


async def generate_and_upload_personal_ticket(
    user_id: uuid.UUID,
    name: str,
    email: str,
    archetype: str,
    top_tags: list[str],
    top_genres: list[str],
    bio: str | None = None,
    personality_reading: str | None = None,
    conversation_style: str | None = None,
    ticket_style: str = "classic",
    avatar_url: str | None = None,
    favorite_movies: list[str] | None = None,
) -> str:
    """Generate personal ticket image and upload to R2.

    Returns public URL of the uploaded ticket.
    """
    image_bytes = await generate_personal_ticket(
        name=name,
        email=email,
        archetype=archetype,
        top_tags=top_tags,
        top_genres=top_genres,
        bio=bio,
        personality_reading=personality_reading,
        conversation_style=conversation_style,
        ticket_style=ticket_style,
        avatar_url=avatar_url,
        favorite_movies=favorite_movies,
    )

    key = f"tickets/personal/{user_id}.png"

    if not settings.s3_endpoint:
        local_path = Path("output") / "tickets" / "personal"
        local_path.mkdir(parents=True, exist_ok=True)
        (local_path / f"{user_id}.png").write_bytes(image_bytes)
        url = f"{settings.api_url}/static/tickets/personal/{user_id}.png"
        logger.info("Dev mode: saved personal ticket locally for user %s", user_id)
        return url

    url = await upload_bytes(image_bytes, key, content_type="image/png")
    return url
