"""Tests for DNA builder: tag vector, genre vector, archetype assignment."""

from app.services.dna_builder import (
    ARCHETYPES,
    TAG_INDEX,
    TAG_KEYS,
    assign_archetype,
    build_dna,
    compute_genre_vector,
    compute_tag_vector,
    get_excluded_tags,
    get_tag_labels,
)


class TestComputeTagVector:
    """Test tag vector computation."""

    def test_empty_picks(self):
        vector = compute_tag_vector([])
        assert len(vector) == len(TAG_KEYS)
        assert all(v == 0.0 for v in vector)

    def test_single_pick_watched(self):
        picks = [{
            "test_dimension": "mindfuck",
            "chosen_tmdb_id": 100,
            "pick_mode": "watched",
        }]
        vector = compute_tag_vector(picks)
        idx = TAG_INDEX["mindfuck"]
        # Single pick, normalized to 1.0
        assert vector[idx] == 1.0

    def test_attracted_has_lower_weight(self):
        picks_watched = [{
            "test_dimension": "mindfuck",
            "chosen_tmdb_id": 100,
            "pick_mode": "watched",
        }, {
            "test_dimension": "darkTone",
            "chosen_tmdb_id": 200,
            "pick_mode": "attracted",
        }]
        vector = compute_tag_vector(picks_watched)
        watched_idx = TAG_INDEX["mindfuck"]
        attracted_idx = TAG_INDEX["darkTone"]
        assert vector[watched_idx] > vector[attracted_idx]

    def test_skipped_picks_ignored(self):
        picks = [{
            "test_dimension": "mindfuck",
            "chosen_tmdb_id": None,
            "pick_mode": None,
        }]
        vector = compute_tag_vector(picks)
        assert all(v == 0.0 for v in vector)

    def test_unknown_dimension_ignored(self):
        picks = [{
            "test_dimension": "unknown_dimension",
            "chosen_tmdb_id": 100,
            "pick_mode": "watched",
        }]
        vector = compute_tag_vector(picks)
        assert all(v == 0.0 for v in vector)

    def test_vector_length_matches_taxonomy(self):
        vector = compute_tag_vector([])
        assert len(vector) == 30


class TestComputeGenreVector:
    """Test genre frequency vector."""

    def test_empty(self):
        result = compute_genre_vector([], {})
        assert result == {}

    def test_single_genre(self):
        picks = [{"chosen_tmdb_id": 100, "pick_mode": "watched"}]
        genre_map = {100: ["Drama", "Thriller"]}
        result = compute_genre_vector(picks, genre_map)
        assert "Drama" in result
        assert "Thriller" in result

    def test_attracted_lower_weight(self):
        picks = [
            {"chosen_tmdb_id": 100, "pick_mode": "watched"},
            {"chosen_tmdb_id": 200, "pick_mode": "attracted"},
        ]
        genre_map = {100: ["Drama"], 200: ["Drama"]}
        # Both pick drama, but watched weighs more
        result = compute_genre_vector(picks, genre_map)
        # 1.0 + 0.7 = 1.7, normalized to 1.0
        assert result["Drama"] == 1.0

    def test_skipped_ignored(self):
        picks = [{"chosen_tmdb_id": None, "pick_mode": None}]
        result = compute_genre_vector(picks, {})
        assert result == {}


class TestGetTagLabels:
    """Test top N tag extraction."""

    def test_returns_top_n(self):
        vector = [0.0] * 30
        vector[0] = 1.0
        vector[1] = 0.8
        vector[2] = 0.5
        labels = get_tag_labels(vector, top_n=2)
        assert len(labels) == 2

    def test_excludes_zero_scores(self):
        vector = [0.0] * 30
        vector[0] = 0.5
        labels = get_tag_labels(vector, top_n=10)
        assert len(labels) == 1

    def test_sorted_by_score(self):
        vector = [0.0] * 30
        vector[0] = 0.3
        vector[1] = 0.9
        vector[2] = 0.6
        labels = get_tag_labels(vector, top_n=3)
        scores = list(labels.values())
        assert scores == sorted(scores, reverse=True)


class TestGetExcludedTags:
    """Test excluded tag detection."""

    def test_all_zero(self):
        vector = [0.0] * 30
        excluded = get_excluded_tags(vector)
        assert len(excluded) == 30

    def test_some_nonzero(self):
        vector = [0.0] * 30
        vector[0] = 0.5
        vector[5] = 0.3
        excluded = get_excluded_tags(vector)
        assert len(excluded) == 28
        assert TAG_KEYS[0] not in excluded
        assert TAG_KEYS[5] not in excluded


class TestAssignArchetype:
    """Test archetype assignment."""

    def test_returns_dict(self):
        vector = [0.0] * 30
        result = assign_archetype(vector, {})
        assert "id" in result
        assert "name" in result

    def test_dark_poet_from_dark_tags(self):
        """High darkTone + antiHero should lean toward dark_poet."""
        vector = [0.0] * 30
        vector[TAG_INDEX["darkTone"]] = 1.0
        vector[TAG_INDEX["antiHero"]] = 0.9
        vector[TAG_INDEX["psychoThriller"]] = 0.8
        result = assign_archetype(vector, {})
        assert result["id"] == "dark_poet"

    def test_emotional_sponge_from_tearjerker(self):
        """High tearjerker + uplifting + romanticCore should lean emotional_sponge."""
        vector = [0.0] * 30
        vector[TAG_INDEX["tearjerker"]] = 1.0
        vector[TAG_INDEX["uplifting"]] = 0.9
        vector[TAG_INDEX["romanticCore"]] = 0.8
        vector[TAG_INDEX["comingOfAge"]] = 0.7
        result = assign_archetype(vector, {})
        assert result["id"] == "emotional_sponge"


class TestBuildDna:
    """Test the complete DNA build pipeline."""

    def test_returns_all_fields(self):
        picks = [{
            "round_number": 1,
            "phase": 1,
            "pair_id": "p1_01",
            "movie_a_tmdb_id": 155,
            "movie_b_tmdb_id": 496243,
            "chosen_tmdb_id": 155,
            "pick_mode": "watched",
            "test_dimension": "mainstream_vs_independent",
        }]
        genre_map = {155: ["Action", "Drama"]}
        result = build_dna(picks, genre_map)

        assert "archetype_id" in result
        assert "tag_vector" in result
        assert "tag_labels" in result
        assert "genre_vector" in result
        assert "quadrant_scores" in result
        assert "ticket_style" in result
        assert "archetype" in result
        assert len(result["tag_vector"]) == 30
