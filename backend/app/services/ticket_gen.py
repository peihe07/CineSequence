"""Ticket generation service: create match ticket images with Pillow."""

import json
import logging
import uuid
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from app.config import settings
from app.services.r2_storage import upload_bytes

logger = logging.getLogger(__name__)

_data_dir = Path(__file__).parent.parent / "data"
_taxonomy = json.loads((_data_dir / "tag_taxonomy.json").read_text())

# Ticket dimensions (2:1 ratio, optimized for social sharing)
TICKET_W = 1200
TICKET_H = 600

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


def _get_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Get a font, falling back to default if custom fonts aren't available."""
    try:
        # Try system fonts
        if bold:
            return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size)
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)
    except (OSError, IOError):
        return ImageFont.load_default()


def _draw_punch_holes(draw: ImageDraw.ImageDraw, y: int, color: tuple):
    """Draw perforated line across the ticket at given y position."""
    for x in range(0, TICKET_W, 24):
        draw.ellipse([x + 8, y - 3, x + 14, y + 3], fill=color)


def _draw_scan_lines(draw: ImageDraw.ImageDraw, palette: dict):
    """Draw subtle horizontal scan lines for retro effect."""
    for y in range(0, TICKET_H, 4):
        draw.line([(0, y), (TICKET_W, y)], fill=(*palette["bg"][:3], 15), width=1)


def generate_ticket_image(
    user_a_name: str,
    user_b_name: str,
    archetype_a: str,
    archetype_b: str,
    shared_tags: list[str],
    similarity_score: float,
    ticket_style: str = "classic",
) -> bytes:
    """Generate a ticket image for a matched pair.

    Returns PNG image as bytes.
    """
    palette = STYLE_PALETTES.get(ticket_style, STYLE_PALETTES["classic"])

    img = Image.new("RGBA", (TICKET_W, TICKET_H), palette["bg"])
    draw = ImageDraw.Draw(img)

    font_lg = _get_font(36, bold=True)
    font_md = _get_font(22)
    font_sm = _get_font(16)
    font_xs = _get_font(13)

    # Scan lines overlay
    _draw_scan_lines(draw, palette)

    # Header: CINE SEQUENCE
    draw.text((48, 36), "CINE SEQUENCE", fill=palette["accent"], font=font_md)

    # Perforated line (top divider)
    _draw_punch_holes(draw, 90, palette["muted"])

    # Left side: User A
    draw.text((48, 116), user_a_name, fill=palette["text"], font=font_lg)
    draw.text((48, 164), archetype_a, fill=palette["muted"], font=font_sm)

    # Center: VS / similarity
    pct = f"{round(similarity_score * 100)}%"
    # Center the percentage text
    bbox = draw.textbbox((0, 0), pct, font=font_lg)
    pct_w = bbox[2] - bbox[0]
    draw.text((TICKET_W // 2 - pct_w // 2, 130), pct, fill=palette["accent"], font=font_lg)
    bbox2 = draw.textbbox((0, 0), "MATCH", font=font_xs)
    match_w = bbox2[2] - bbox2[0]
    draw.text((TICKET_W // 2 - match_w // 2, 174), "MATCH", fill=palette["muted"], font=font_xs)

    # Right side: User B
    bbox3 = draw.textbbox((0, 0), user_b_name, font=font_lg)
    name_w = bbox3[2] - bbox3[0]
    draw.text((TICKET_W - 48 - name_w, 116), user_b_name, fill=palette["text"], font=font_lg)
    bbox4 = draw.textbbox((0, 0), archetype_b, font=font_sm)
    arch_w = bbox4[2] - bbox4[0]
    draw.text((TICKET_W - 48 - arch_w, 164), archetype_b, fill=palette["muted"], font=font_sm)

    # Perforated line (middle divider)
    _draw_punch_holes(draw, 220, palette["muted"])

    # Shared tags section
    draw.text((48, 244), "SHARED TASTE", fill=palette["muted"], font=font_xs)
    tag_x = 48
    tag_y = 274
    for tag_key in shared_tags[:6]:
        tag_label = _taxonomy["tags"].get(tag_key, {}).get("zh", tag_key)
        bbox_tag = draw.textbbox((0, 0), tag_label, font=font_sm)
        tw = bbox_tag[2] - bbox_tag[0]

        # Tag pill background
        draw.rounded_rectangle(
            [tag_x - 4, tag_y - 4, tag_x + tw + 12, tag_y + 24],
            radius=4,
            fill=(*palette["accent"], 30),
            outline=(*palette["accent"], 80),
        )
        draw.text((tag_x + 4, tag_y), tag_label, fill=palette["accent"], font=font_sm)
        tag_x += tw + 28
        if tag_x > TICKET_W - 100:
            tag_x = 48
            tag_y += 40

    # Perforated line (bottom divider)
    _draw_punch_holes(draw, TICKET_H - 100, palette["muted"])

    # Footer
    draw.text(
        (48, TICKET_H - 72),
        "cinesequence.app",
        fill=palette["muted"],
        font=font_xs,
    )

    # Ticket serial number
    serial = f"#{uuid.uuid4().hex[:8].upper()}"
    bbox_serial = draw.textbbox((0, 0), serial, font=font_xs)
    serial_w = bbox_serial[2] - bbox_serial[0]
    draw.text(
        (TICKET_W - 48 - serial_w, TICKET_H - 72),
        serial,
        fill=palette["muted"],
        font=font_xs,
    )

    # Convert to PNG bytes
    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


async def generate_and_upload_ticket(
    match_id: uuid.UUID,
    user_a_name: str,
    user_b_name: str,
    archetype_a: str,
    archetype_b: str,
    shared_tags: list[str],
    similarity_score: float,
    ticket_style: str = "classic",
) -> str:
    """Generate ticket image and upload to R2.

    Returns public URL of the uploaded ticket.
    """
    image_bytes = generate_ticket_image(
        user_a_name=user_a_name,
        user_b_name=user_b_name,
        archetype_a=archetype_a,
        archetype_b=archetype_b,
        shared_tags=shared_tags,
        similarity_score=similarity_score,
        ticket_style=ticket_style,
    )

    key = f"tickets/{match_id}.png"

    if not settings.s3_endpoint:
        # Dev mode: save locally
        local_path = Path("output") / "tickets"
        local_path.mkdir(parents=True, exist_ok=True)
        (local_path / f"{match_id}.png").write_bytes(image_bytes)
        url = f"{settings.api_url}/static/tickets/{match_id}.png"
        logger.info("Dev mode: saved ticket locally at output/tickets/%s.png", match_id)
        return url

    url = await upload_bytes(image_bytes, key, content_type="image/png")
    return url
