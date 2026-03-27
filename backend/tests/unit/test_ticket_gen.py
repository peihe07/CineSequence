"""Tests for personal ticket generation: HTML rendering via Playwright."""

from io import BytesIO

import pytest
from PIL import Image

from app.services.ticket_gen import (
    STYLE_PALETTES,
    TICKET_W,
    _build_ticket_html,
    generate_personal_ticket,
)

_DEFAULTS = {
    "name": "Alice",
    "email": "alice@test.com",
    "archetype": "Time Traveler",
    "top_tags": ["mindfuck", "philosophical"],
    "top_genres": ["劇情", "科幻"],
    "ticket_style": "classic",
}


class TestBuildTicketHtml:
    """Test HTML template generation (no browser needed)."""

    def test_contains_name_and_email(self):
        html = _build_ticket_html(**_DEFAULTS)
        assert "Alice" in html
        assert "alice@test.com" in html

    def test_contains_archetype(self):
        html = _build_ticket_html(**_DEFAULTS)
        assert "Time Traveler" in html

    def test_contains_tags(self):
        html = _build_ticket_html(**_DEFAULTS)
        assert "燒腦" in html
        assert "哲學思辨" in html

    def test_contains_bio(self):
        html = _build_ticket_html(**{**_DEFAULTS, "bio": "喜歡看電影"})
        assert "喜歡看電影" in html

    def test_contains_favorites(self):
        html = _build_ticket_html(
            **{**_DEFAULTS, "favorite_movies": ["乘風破浪", "花樣年華"]}
        )
        assert "乘風破浪" in html
        assert "花樣年華" in html

    def test_contains_genres(self):
        html = _build_ticket_html(**_DEFAULTS)
        assert "劇情" in html
        assert "科幻" in html

    def test_escapes_html_entities(self):
        html = _build_ticket_html(**{**_DEFAULTS, "name": "<script>alert(1)</script>"})
        assert "<script>" not in html
        assert "&lt;script&gt;" in html

    def test_unknown_style_falls_back(self):
        html = _build_ticket_html(**{**_DEFAULTS, "ticket_style": "nonexistent"})
        assert "CINE SEQUENCE" in html

    def test_no_tags_or_genres(self):
        html = _build_ticket_html(
            **{**_DEFAULTS, "top_tags": [], "top_genres": []}
        )
        assert "TASTE TAGS" not in html

    def test_no_favorites(self):
        html = _build_ticket_html(**_DEFAULTS)
        assert "MUST-WATCH FILMS" not in html

    def test_all_styles_produce_html(self):
        for style in STYLE_PALETTES:
            html = _build_ticket_html(**{**_DEFAULTS, "ticket_style": style})
            assert "CINE SEQUENCE" in html

    def test_tags_truncated_to_eight(self):
        tags = [
            "mindfuck", "twist", "philosophical", "existential",
            "darkTone", "slowburn", "dialogue", "experimental",
            "visualFeast", "cult",
        ]
        html = _build_ticket_html(**{**_DEFAULTS, "top_tags": tags})
        # 第 9 個 tag "視覺饗宴" 不應出現
        assert "邪典" not in html


@pytest.mark.asyncio
class TestGeneratePersonalTicket:
    """Test screenshot rendering (requires Playwright + Chromium)."""

    async def _generate(self, **kwargs) -> Image.Image:
        params = {**_DEFAULTS, **kwargs}
        data = await generate_personal_ticket(**params)
        return Image.open(BytesIO(data))

    async def test_returns_png_bytes(self):
        data = await generate_personal_ticket(
            name="A",
            email="a@test.com",
            archetype="X",
            top_tags=[],
            top_genres=[],
        )
        assert isinstance(data, bytes)
        assert len(data) > 0
        assert data[:4] == b"\x89PNG"

    async def test_correct_dimensions(self):
        img = await self._generate()
        # 2x device_scale_factor
        assert img.size[0] == TICKET_W * 2
        assert img.size[1] > 0

    async def test_rgba_mode(self):
        img = await self._generate()
        assert img.mode == "RGBA"

    async def test_all_styles_produce_images(self):
        for style in STYLE_PALETTES:
            data = await generate_personal_ticket(
                **{**_DEFAULTS, "ticket_style": style}
            )
            assert data[:4] == b"\x89PNG"

    async def test_unicode_names(self):
        img = await self._generate(
            name="時空旅人",
            archetype="時空旅人 Time Traveler",
        )
        assert img.size[0] == TICKET_W * 2
        assert img.size[1] > 0


class TestStylePalettes:
    """Test style palette configuration."""

    def test_all_styles_have_required_keys(self):
        required = {
            "bg_from",
            "bg_to",
            "accent",
            "accent_alpha",
            "text",
            "muted",
            "stripe",
            "stripe_end",
        }
        for style, palette in STYLE_PALETTES.items():
            assert required.issubset(palette.keys()), f"{style} missing keys"

    def test_accent_alpha_is_format_string(self):
        for style, palette in STYLE_PALETTES.items():
            result = palette["accent_alpha"].format("0.5")
            assert "0.5" in result, f"{style} accent_alpha format failed"
