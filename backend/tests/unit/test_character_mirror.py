"""Tests for character mirror service: resonance scoring and diversity constraints."""

from unittest.mock import MagicMock, patch

import pytest

from app.services.character_mirror import (
    CharacterMatch,
    _archetype_affinity,
    _cosine_similarity,
    _quadrant_proximity,
    find_resonant_characters,
)


def _make_profile(tag_vector: list[float], quadrant: dict, archetype_id: str):
    profile = MagicMock()
    profile.tag_vector = tag_vector
    profile.quadrant_scores = quadrant
    profile.archetype_id = archetype_id
    return profile


_ZERO_VECTOR = [0.0] * 35
_DARK_EXISTENTIAL_VECTOR = [
    0.0, 0.0, 0.7, 0.0, 0.8,  # twist, mindfuck, slowburn, ensemble, solo
    0.0, 0.3, 0.0, 0.9, 0.0,  # visualFeast, dialogue, tearjerker, darkTone, uplifting
    0.5, 0.0, 0.0, 0.3, 0.4,  # philosophical, satirical, nostalgic, experimental, cult
    0.0, 0.0, 0.0, 0.0, 0.0,  # comingOfAge, revenge, heist, survival, timeTravel
    0.0, 0.0, 0.0, 0.8, 0.4,  # dystopia, trueStory, nonEnglish, existential, antiHero
    0.0, 0.0, 0.3, 0.0, 0.0,  # romanticCore, violentAesthetic, socialCritique, psychoThriller, absurdist
    0.7, 0.6, 0.5, 0.0, 0.6,  # artHouseBridge, urbanLoneliness, driftCinema, blackComedy, moralAnxiety
]


class TestCosineSimilarity:
    def test_identical_vectors(self):
        v = [1.0, 0.5, 0.3]
        assert _cosine_similarity(v, v) == pytest.approx(1.0)

    def test_orthogonal_vectors(self):
        assert _cosine_similarity([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)

    def test_zero_vector_returns_zero(self):
        assert _cosine_similarity([0.0, 0.0], [1.0, 0.5]) == 0.0

    def test_partial_overlap(self):
        a = [1.0, 0.0, 1.0]
        b = [1.0, 1.0, 0.0]
        result = _cosine_similarity(a, b)
        assert 0.0 < result < 1.0


class TestQuadrantProximity:
    def test_identical_quadrant(self):
        q = {"mainstream_independent": 3.0, "rational_emotional": 2.5, "light_dark": 4.0}
        assert _quadrant_proximity(q, q) == pytest.approx(1.0)

    def test_opposite_quadrant_is_low(self):
        user = {"mainstream_independent": 1.0, "rational_emotional": 1.0, "light_dark": 1.0}
        char = {"mainstream_independent": 5.0, "rational_emotional": 5.0, "light_dark": 5.0}
        result = _quadrant_proximity(user, char)
        assert result == pytest.approx(0.0)

    def test_partial_proximity(self):
        user = {"mainstream_independent": 2.0, "rational_emotional": 3.0, "light_dark": 4.0}
        char = {"mainstream_independent": 4.0, "rational_emotional": 3.0, "light_dark": 2.0}
        result = _quadrant_proximity(user, char)
        assert 0.0 < result < 1.0

    def test_missing_axis_defaults_to_midpoint(self):
        user = {}
        char = {"mainstream_independent": 3.0, "rational_emotional": 3.0, "light_dark": 3.0}
        assert _quadrant_proximity(user, char) == pytest.approx(1.0)


class TestArchetypeAffinity:
    def test_primary_framework_returns_one(self):
        assert _archetype_affinity("dark_poet", "shadow_self") == pytest.approx(1.0)

    def test_secondary_framework_returns_point_seven(self):
        assert _archetype_affinity("dark_poet", "existential_crisis") == pytest.approx(0.7)

    def test_unrelated_framework_returns_point_three(self):
        assert _archetype_affinity("dark_poet", "attachment_style") == pytest.approx(0.3)

    def test_unknown_archetype_returns_midpoint(self):
        assert _archetype_affinity("unknown_archetype", "shadow_self") == pytest.approx(0.5)


class TestFindResonantCharacters:
    def test_returns_three_characters(self):
        profile = _make_profile(
            _DARK_EXISTENTIAL_VECTOR,
            {"mainstream_independent": 4.5, "rational_emotional": 2.0, "light_dark": 4.5},
            "dark_poet",
        )
        results = find_resonant_characters(profile)
        assert len(results) == 3

    def test_all_are_character_match_instances(self):
        profile = _make_profile(_DARK_EXISTENTIAL_VECTOR, {}, "lone_wolf")
        results = find_resonant_characters(profile)
        assert all(isinstance(r, CharacterMatch) for r in results)

    def test_no_duplicate_movies(self):
        profile = _make_profile(_DARK_EXISTENTIAL_VECTOR, {}, "dark_poet")
        results = find_resonant_characters(profile)
        tmdb_ids = [r.tmdb_id for r in results]
        assert len(tmdb_ids) == len(set(tmdb_ids))

    def test_at_least_two_frameworks(self):
        profile = _make_profile(
            _DARK_EXISTENTIAL_VECTOR,
            {"mainstream_independent": 4.5, "rational_emotional": 2.0, "light_dark": 4.8},
            "dark_poet",
        )
        results = find_resonant_characters(profile)
        frameworks = {r.psych_framework for r in results}
        assert len(frameworks) >= 2

    def test_scores_are_between_zero_and_one(self):
        profile = _make_profile(_DARK_EXISTENTIAL_VECTOR, {}, "quiet_observer")
        results = find_resonant_characters(profile)
        for r in results:
            assert 0.0 <= r.score <= 1.0

    def test_zero_vector_still_returns_three(self):
        profile = _make_profile(_ZERO_VECTOR, {}, "emotional_sponge")
        results = find_resonant_characters(profile)
        assert len(results) == 3

    def test_required_fields_present(self):
        profile = _make_profile(_DARK_EXISTENTIAL_VECTOR, {}, "dark_poet")
        results = find_resonant_characters(profile)
        for r in results:
            assert r.id
            assert r.name
            assert r.movie
            assert r.tmdb_id
            assert r.psych_labels
            assert r.psych_framework
            assert r.one_liner
            assert r.mirror_reading is None  # not yet generated
