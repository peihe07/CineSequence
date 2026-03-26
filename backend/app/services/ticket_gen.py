"""Ticket generation service: create personal movie ID card images with Pillow."""

import json
import logging
import uuid
from io import BytesIO
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

from PIL import Image, ImageDraw, ImageFont, ImageOps

from app.config import settings
from app.services.r2_storage import upload_bytes

logger = logging.getLogger(__name__)

_data_dir = Path(__file__).parent.parent / "data"
_taxonomy = json.loads((_data_dir / "tag_taxonomy.json").read_text())

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

# Ticket dimensions (portrait card, like a real movie ticket)
TICKET_W = 800
TICKET_H = 1200

# Color palettes per ticket_style
STYLE_PALETTES = {
    "scifi": {
        "bg": (15, 23, 42),
        "accent": (56, 189, 248),
        "text": (226, 232, 240),
        "muted": (100, 116, 139),
    },
    "noir": {
        "bg": (24, 24, 27),
        "accent": (239, 68, 68),
        "text": (228, 228, 231),
        "muted": (113, 113, 122),
    },
    "classic": {
        "bg": (254, 249, 239),
        "accent": (180, 83, 9),
        "text": (68, 64, 60),
        "muted": (168, 162, 158),
    },
    "indie": {
        "bg": (236, 234, 227),
        "accent": (22, 101, 52),
        "text": (68, 81, 75),
        "muted": (138, 145, 137),
    },
    "action": {
        "bg": (30, 27, 24),
        "accent": (249, 115, 22),
        "text": (231, 229, 228),
        "muted": (120, 113, 108),
    },
}


_fonts_dir = Path(__file__).parent.parent / "fonts"

_FONT_PATHS = {
    "regular": [
        _fonts_dir / "NotoSansTC-Regular.ttf",
        Path("/System/Library/Fonts/Hiragino Sans GB.ttc"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ],
    "bold": [
        _fonts_dir / "NotoSansTC-Bold.ttf",
        Path("/System/Library/Fonts/STHeiti Light.ttc"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ],
}


def _get_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Get a CJK-compatible font, trying bundled fonts first."""
    candidates = _FONT_PATHS["bold"] if bold else _FONT_PATHS["regular"]
    for path in candidates:
        try:
            return ImageFont.truetype(str(path), size)
        except OSError:
            continue
    return ImageFont.load_default()


def _draw_punch_holes(draw: ImageDraw.ImageDraw, y: int, color: tuple):
    """Draw perforated line across the ticket at given y position."""
    for x in range(0, TICKET_W, 20):
        draw.ellipse([x + 6, y - 3, x + 12, y + 3], fill=color)


def _draw_tag_pills(
    draw: ImageDraw.ImageDraw,
    tags: list[str],
    x_start: int,
    y_start: int,
    font: ImageFont.FreeTypeFont,
    palette: dict,
    max_tags: int = 8,
) -> int:
    """Draw tag pill badges. Returns the y position after the last row."""
    tag_x = x_start
    tag_y = y_start
    for tag_key in tags[:max_tags]:
        tag_label = _TAG_ZH_LABELS.get(
            tag_key,
            _taxonomy["tags"].get(tag_key, {}).get("zh", tag_key),
        )
        bbox_tag = draw.textbbox((0, 0), tag_label, font=font)
        tw = bbox_tag[2] - bbox_tag[0]

        draw.rounded_rectangle(
            [tag_x - 4, tag_y - 4, tag_x + tw + 12, tag_y + 26],
            radius=4,
            fill=(*palette["accent"], 30),
            outline=(*palette["accent"], 80),
        )
        draw.text((tag_x + 4, tag_y), tag_label, fill=palette["accent"], font=font)
        tag_x += tw + 28
        if tag_x > TICKET_W - 80:
            tag_x = x_start
            tag_y += 40
    return tag_y + 40


def _load_avatar_image(avatar_url: str | None, size: int) -> Image.Image | None:
    """Fetch and fit an avatar image for the ticket if available."""
    if not avatar_url:
        return None

    try:
        with urlopen(avatar_url, timeout=4) as response:
            avatar = Image.open(BytesIO(response.read())).convert("RGB")
    except (OSError, URLError, ValueError):
        logger.info("Skipping avatar render for ticket: %s", avatar_url)
        return None

    avatar = ImageOps.fit(avatar, (size, size), method=Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((0, 0, size, size), radius=28, fill=255)
    avatar.putalpha(mask)
    return avatar


def _wrap_text(text: str, max_chars: int) -> list[str]:
    """Wrap text to fit within max_chars per line."""
    lines = []
    for line in text.split("\n"):
        while len(line) > max_chars:
            lines.append(line[:max_chars])
            line = line[max_chars:]
        if line:
            lines.append(line)
    return lines


def _draw_favorite_movies(
    draw: ImageDraw.ImageDraw,
    favorite_movies: list[str],
    x_start: int,
    y_start: int,
    font: ImageFont.FreeTypeFont,
    palette: dict,
) -> int:
    """Draw a compact favorite-movies list and return the next y offset."""
    for movie in favorite_movies[:3]:
        for line in _wrap_text(movie, 24)[:2]:
            draw.text((x_start, y_start), f"· {line}", fill=palette["text"], font=font)
            y_start += 24
        y_start += 4
    return y_start


def generate_personal_ticket(
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
    """Generate a personal movie ID card for one user.

    Returns PNG image as bytes.
    """
    palette = STYLE_PALETTES.get(ticket_style, STYLE_PALETTES["classic"])

    img = Image.new("RGBA", (TICKET_W, TICKET_H), palette["bg"])
    draw = ImageDraw.Draw(img)

    font_title = _get_font(44, bold=True)
    font_md = _get_font(20)
    font_sm = _get_font(16)
    font_xs = _get_font(13)
    favorite_movies = favorite_movies or []

    # Subtle scan lines
    scan_step = 6 if palette["bg"][0] < 50 else 4
    for sy in range(0, TICKET_H, scan_step):
        draw.line([(0, sy), (TICKET_W, sy)], fill=(*palette["bg"][:3], 10), width=1)

    pad = 48
    cursor_y = 40

    # ── Header ──
    draw.text((pad, cursor_y), "CINE SEQUENCE", fill=palette["accent"], font=font_md)
    cursor_y += 50
    _draw_punch_holes(draw, cursor_y, palette["muted"])
    cursor_y += 24

    avatar = _load_avatar_image(avatar_url, size=132)
    info_width = TICKET_W - (pad * 2) - (148 if avatar else 0)
    if avatar:
        img.alpha_composite(avatar, (TICKET_W - pad - 132, cursor_y))

    # ── Name + Archetype ──
    draw.text((pad, cursor_y), name, fill=palette["text"], font=font_title)
    cursor_y += 56
    draw.text((pad, cursor_y), archetype, fill=palette["muted"], font=font_md)
    cursor_y += 32

    # ── Email ──
    draw.text((pad, cursor_y), email, fill=palette["accent"], font=font_sm)
    cursor_y += 32

    # ── Bio ──
    if bio:
        bio_chars = 34 if info_width < 560 else 38
        for line in _wrap_text(bio, bio_chars)[:3]:
            draw.text((pad, cursor_y), line, fill=palette["text"], font=font_sm)
            cursor_y += 24
        cursor_y += 8

    if avatar:
        cursor_y = max(cursor_y, 40 + 132 + 16)

    _draw_punch_holes(draw, cursor_y, palette["muted"])
    cursor_y += 24

    # ── Taste DNA (tags) ──
    draw.text((pad, cursor_y), "TASTE TAGS", fill=palette["muted"], font=font_xs)
    cursor_y += 24
    cursor_y = _draw_tag_pills(draw, top_tags, pad, cursor_y, font_sm, palette)

    # ── Favorite movies ──
    if favorite_movies:
        _draw_punch_holes(draw, cursor_y, palette["muted"])
        cursor_y += 20
        draw.text((pad, cursor_y), "MUST-WATCH FILMS", fill=palette["muted"], font=font_xs)
        cursor_y += 24
        cursor_y = _draw_favorite_movies(draw, favorite_movies, pad, cursor_y, font_sm, palette)
        cursor_y += 8

    # ── Footer ──
    _draw_punch_holes(draw, TICKET_H - 60, palette["muted"])
    draw.text((pad, TICKET_H - 40), "cinesequence.app", fill=palette["muted"], font=font_xs)

    serial = f"#{uuid.uuid4().hex[:8].upper()}"
    bbox_serial = draw.textbbox((0, 0), serial, font=font_xs)
    serial_w = bbox_serial[2] - bbox_serial[0]
    draw.text(
        (TICKET_W - pad - serial_w, TICKET_H - 40),
        serial,
        fill=palette["muted"],
        font=font_xs,
    )

    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


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
    image_bytes = generate_personal_ticket(
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
