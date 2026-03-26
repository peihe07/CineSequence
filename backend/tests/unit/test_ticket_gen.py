"""Tests for personal ticket generation: image creation and style palettes."""

from io import BytesIO

from PIL import Image

from app.services.ticket_gen import (
    STYLE_PALETTES,
    TICKET_H,
    TICKET_W,
    generate_personal_ticket,
)


class TestGeneratePersonalTicket:
    """Test personal ticket image generation."""

    def _generate(self, **kwargs) -> Image.Image:
        defaults = {
            "name": "Alice",
            "email": "alice@test.com",
            "archetype": "Time Traveler",
            "top_tags": ["mindfuck", "philosophical"],
            "top_genres": ["劇情", "科幻"],
            "ticket_style": "classic",
        }
        defaults.update(kwargs)
        data = generate_personal_ticket(**defaults)
        return Image.open(BytesIO(data))

    def test_returns_png_bytes(self):
        data = generate_personal_ticket(
            name="A",
            email="a@test.com",
            archetype="X",
            top_tags=[],
            top_genres=[],
        )
        assert isinstance(data, bytes)
        assert len(data) > 0
        assert data[:4] == b"\x89PNG"

    def test_correct_dimensions(self):
        img = self._generate()
        assert img.size == (TICKET_W, TICKET_H)

    def test_rgba_mode(self):
        img = self._generate()
        assert img.mode == "RGBA"

    def test_all_styles_produce_images(self):
        for style in STYLE_PALETTES:
            img = self._generate(ticket_style=style)
            assert img.size == (TICKET_W, TICKET_H)

    def test_unknown_style_falls_back_to_classic(self):
        img = self._generate(ticket_style="nonexistent")
        assert img.size == (TICKET_W, TICKET_H)

    def test_no_tags_or_genres(self):
        img = self._generate(top_tags=[], top_genres=[])
        assert img.size == (TICKET_W, TICKET_H)

    def test_many_tags_truncated(self):
        """More than 8 tags should still produce a valid image."""
        tags = [
            "mindfuck", "twist", "philosophical", "existential",
            "darkTone", "slowburn", "dialogue", "experimental",
            "visualFeast", "nonlinear_narrative",
        ]
        img = self._generate(top_tags=tags)
        assert img.size == (TICKET_W, TICKET_H)

    def test_with_bio_and_personality(self):
        img = self._generate(
            bio="喜歡看電影",
            personality_reading="你有獨特的觀影品味。",
            conversation_style="冷靜分析型",
        )
        assert img.size == (TICKET_W, TICKET_H)

    def test_unicode_names(self):
        """Chinese names should render without errors."""
        img = self._generate(
            name="時空旅人",
            archetype="時空旅人 Time Traveler",
        )
        assert img.size == (TICKET_W, TICKET_H)


class TestStylePalettes:
    """Test style palette configuration."""

    def test_all_styles_have_required_keys(self):
        required = {"bg", "accent", "text", "muted"}
        for style, palette in STYLE_PALETTES.items():
            assert required.issubset(palette.keys()), f"{style} missing keys"

    def test_all_colors_are_rgb_tuples(self):
        for style, palette in STYLE_PALETTES.items():
            for key, color in palette.items():
                assert isinstance(color, tuple), f"{style}.{key} not a tuple"
                assert len(color) == 3, f"{style}.{key} not RGB"
                assert all(0 <= c <= 255 for c in color), f"{style}.{key} out of range"
