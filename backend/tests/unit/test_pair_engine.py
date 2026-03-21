"""Tests for pair engine: Phase 1 rule-based pair selection."""

import pytest

from app.services.pair_engine import (
    ALL_PAIRS,
    compute_quadrant_from_picks,
    get_pair_for_round,
    get_phase1_pairs,
)


class TestGetPhase1Pairs:
    """Test phase 1 pair selection and ordering."""

    def test_returns_five_pairs(self):
        pairs = get_phase1_pairs()
        assert len(pairs) == 5

    def test_all_pairs_have_required_fields(self):
        pairs = get_phase1_pairs()
        for pair in pairs:
            assert "id" in pair
            assert "dimension" in pair
            assert "movie_a" in pair
            assert "movie_b" in pair
            assert "tmdb_id" in pair["movie_a"]
            assert "tmdb_id" in pair["movie_b"]

    def test_covers_all_quadrant_axes(self):
        """Phase 1 must cover mainstream_vs_independent, rational_vs_emotional, light_vs_dark."""
        pairs = get_phase1_pairs()
        dimensions = {p["dimension"] for p in pairs}
        assert "mainstream_vs_independent" in dimensions
        assert "rational_vs_emotional" in dimensions
        assert "light_vs_dark" in dimensions

    def test_seed_genres_reorder(self):
        """Seed genres should reorder pairs by relevance."""
        default_order = [p["id"] for p in get_phase1_pairs()]
        action_order = [p["id"] for p in get_phase1_pairs(["Action"])]
        # With action genres, the order may differ
        # Both should contain the same set of pairs
        assert set(default_order) == set(action_order)

    def test_no_seed_genres_returns_default_order(self):
        pairs_none = get_phase1_pairs(None)
        pairs_empty = get_phase1_pairs([])
        assert [p["id"] for p in pairs_none] == [p["id"] for p in pairs_empty]


class TestGetPairForRound:
    """Test getting a specific pair by round number."""

    def test_valid_rounds(self):
        for round_num in range(1, 6):
            pair = get_pair_for_round(round_num)
            assert pair is not None
            assert "id" in pair

    def test_invalid_round_raises(self):
        with pytest.raises(ValueError, match="Invalid Phase 1 round number"):
            get_pair_for_round(0)
        with pytest.raises(ValueError, match="Invalid Phase 1 round number"):
            get_pair_for_round(6)

    def test_rounds_are_consistent(self):
        """Same round should always return the same pair."""
        pair1 = get_pair_for_round(1)
        pair2 = get_pair_for_round(1)
        assert pair1["id"] == pair2["id"]


class TestComputeQuadrantFromPicks:
    """Test quadrant score computation from picks."""

    def test_no_picks_returns_neutral(self):
        scores = compute_quadrant_from_picks([])
        assert scores["mainstream_independent"] == 3.0
        assert scores["rational_emotional"] == 3.0
        assert scores["light_dark"] == 3.0

    def test_non_phase1_picks_ignored(self):
        picks = [{"phase": 2, "pair_id": "p1_01", "chosen_tmdb_id": 155}]
        scores = compute_quadrant_from_picks(picks)
        assert scores["mainstream_independent"] == 3.0

    def test_choosing_movie_a_shifts_negative(self):
        """Choosing movie_a (mainstream/rational/light side) shifts score down."""
        pair = ALL_PAIRS[0]  # p1_01: mainstream_vs_independent
        picks = [{
            "phase": 1,
            "pair_id": pair["id"],
            "chosen_tmdb_id": pair["movie_a"]["tmdb_id"],
        }]
        scores = compute_quadrant_from_picks(picks)
        assert scores["mainstream_independent"] == 2.5  # 3.0 - 0.5

    def test_choosing_movie_b_shifts_positive(self):
        """Choosing movie_b (independent/emotional/dark side) shifts score up."""
        pair = ALL_PAIRS[0]  # p1_01: mainstream_vs_independent
        picks = [{
            "phase": 1,
            "pair_id": pair["id"],
            "chosen_tmdb_id": pair["movie_b"]["tmdb_id"],
        }]
        scores = compute_quadrant_from_picks(picks)
        assert scores["mainstream_independent"] == 3.5  # 3.0 + 0.5

    def test_scores_clamped_to_range(self):
        """Scores should stay within [1.0, 5.0]."""
        pair = ALL_PAIRS[0]
        # Create many picks choosing the same side
        picks = [
            {
                "phase": 1,
                "pair_id": pair["id"],
                "chosen_tmdb_id": pair["movie_a"]["tmdb_id"],
            }
        ] * 20
        scores = compute_quadrant_from_picks(picks)
        assert scores["mainstream_independent"] >= 1.0

    def test_skip_picks_with_no_chosen_tmdb_id(self):
        """Picks with chosen_tmdb_id=None (skips) should not affect scores."""
        picks = [{"phase": 1, "pair_id": "p1_01", "chosen_tmdb_id": None}]
        scores = compute_quadrant_from_picks(picks)
        assert scores["mainstream_independent"] == 3.0


class TestPhase1PairsData:
    """Validate the seed data integrity."""

    def test_all_pairs_have_unique_ids(self):
        ids = [p["id"] for p in ALL_PAIRS]
        assert len(ids) == len(set(ids))

    def test_all_tmdb_ids_are_positive(self):
        for pair in ALL_PAIRS:
            assert pair["movie_a"]["tmdb_id"] > 0
            assert pair["movie_b"]["tmdb_id"] > 0

    def test_no_pair_has_same_movie(self):
        for pair in ALL_PAIRS:
            assert pair["movie_a"]["tmdb_id"] != pair["movie_b"]["tmdb_id"]
