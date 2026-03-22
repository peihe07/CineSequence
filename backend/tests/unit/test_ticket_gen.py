"""Tests for ticket generation: image creation and style palettes."""

from io import BytesIO

from PIL import Image

from app.services.ticket_gen import (
    STYLE_PALETTES,
    TICKET_H,
    TICKET_W,
    generate_ticket_image,
)


class TestGenerateTicketImage:
    """Test ticket image generation."""

    def _generate(self, **kwargs) -> Image.Image:
        defaults = {
            "user_a_name": "Alice",
            "user_b_name": "Bob",
            "archetype_a": "Time Traveler",
            "archetype_b": "Dark Poet",
            "shared_tags": ["mindfuck", "philosophical"],
            "similarity_score": 0.85,
            "ticket_style": "classic",
        }
        defaults.update(kwargs)
        data = generate_ticket_image(**defaults)
        return Image.open(BytesIO(data))

    def test_returns_png_bytes(self):
        data = generate_ticket_image(
            user_a_name="A",
            user_b_name="B",
            archetype_a="X",
            archetype_b="Y",
            shared_tags=[],
            similarity_score=0.5,
        )
        assert isinstance(data, bytes)
        assert len(data) > 0
        # PNG magic bytes
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

    def test_no_shared_tags(self):
        img = self._generate(shared_tags=[])
        assert img.size == (TICKET_W, TICKET_H)

    def test_many_shared_tags_truncated(self):
        """More than 6 tags should still produce a valid image."""
        tags = [
            "mindfuck", "twist", "philosophical", "existential",
            "darkTone", "slowburn", "dialogue", "experimental",
        ]
        img = self._generate(shared_tags=tags)
        assert img.size == (TICKET_W, TICKET_H)

    def test_high_similarity(self):
        img = self._generate(similarity_score=0.99)
        assert img.size == (TICKET_W, TICKET_H)

    def test_low_similarity(self):
        img = self._generate(similarity_score=0.01)
        assert img.size == (TICKET_W, TICKET_H)

    def test_unicode_names(self):
        """Chinese names should render without errors."""
        img = self._generate(
            user_a_name="時空旅人",
            user_b_name="黑暗詩人",
            archetype_a="時空旅人 Time Traveler",
            archetype_b="黑暗詩人 Dark Poet",
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
