"""Tests for pair engine: Phase 1 pair selection with randomized coverage."""

import pytest

from app.services.pair_engine import (
    ALL_PAIRS,
    REQUIRED_AXES,
    compute_quadrant_from_picks,
    get_pair_for_round,
    get_phase1_pairs,
)


class TestGetPhase1Pairs:
    """Test phase 1 pair selection and ordering."""

    def test_returns_five_pairs(self):
        pairs = get_phase1_pairs(session_seed="test-session-1")
        assert len(pairs) == 5

    def test_all_pairs_have_required_fields(self):
        pairs = get_phase1_pairs(session_seed="test-session-2")
        for pair in pairs:
            assert "id" in pair
            assert "dimension" in pair
            assert "movie_a" in pair
            assert "movie_b" in pair
            assert "tmdb_id" in pair["movie_a"]
            assert "tmdb_id" in pair["movie_b"]

    def test_covers_all_quadrant_axes(self):
        """Phase 1 must cover mainstream_vs_independent, rational_vs_emotional, light_vs_dark."""
        # Test with multiple seeds to verify coverage is guaranteed
        for i in range(20):
            pairs = get_phase1_pairs(session_seed=f"coverage-test-{i}")
            dimensions = {p["dimension"] for p in pairs}
            for axis in REQUIRED_AXES:
                assert axis in dimensions, (
                    f"Seed coverage-test-{i} missing axis {axis}. "
                    f"Got dimensions: {dimensions}"
                )

    def test_seed_genres_affect_selection(self):
        """Seed genres should influence pair weighting."""
        # Both should return 5 pairs with quadrant coverage
        pairs_action = get_phase1_pairs(["Action"], session_seed="genre-test")
        pairs_romance = get_phase1_pairs(["Romance"], session_seed="genre-test")
        # Different genres may produce different selections
        assert len(pairs_action) == 5
        assert len(pairs_romance) == 5

    def test_deterministic_with_same_seed(self):
        """Same session_seed should always produce the same pairs."""
        pairs_a = get_phase1_pairs(session_seed="deterministic-test")
        pairs_b = get_phase1_pairs(session_seed="deterministic-test")
        assert [p["id"] for p in pairs_a] == [p["id"] for p in pairs_b]

    def test_different_seeds_produce_variation(self):
        """Different seeds should produce different pair selections over many trials."""
        results = set()
        for i in range(30):
            pairs = get_phase1_pairs(session_seed=f"variation-{i}")
            pair_ids = tuple(sorted(p["id"] for p in pairs))
            results.add(pair_ids)
        # With 40 pairs and random selection, we expect variety
        assert len(results) > 5, "Expected variety across different seeds"

    def test_no_movie_overlap_within_selection(self):
        """No TMDB ID should appear in more than one pair within a selection."""
        for i in range(20):
            pairs = get_phase1_pairs(session_seed=f"overlap-test-{i}")
            tmdb_ids = []
            for pair in pairs:
                tmdb_ids.append(pair["movie_a"]["tmdb_id"])
                tmdb_ids.append(pair["movie_b"]["tmdb_id"])
            assert len(tmdb_ids) == len(set(tmdb_ids)), (
                f"Seed overlap-test-{i} has duplicate TMDB IDs"
            )


class TestGetPairForRound:
    """Test getting a specific pair by round number."""

    def test_valid_rounds(self):
        for round_num in range(1, 6):
            pair = get_pair_for_round(round_num, session_seed="round-test")
            assert pair is not None
            assert "id" in pair

    def test_invalid_round_raises(self):
        with pytest.raises(ValueError, match="Invalid Phase 1 round number"):
            get_pair_for_round(0, session_seed="err-test")
        with pytest.raises(ValueError, match="Invalid Phase 1 round number"):
            get_pair_for_round(6, session_seed="err-test")

    def test_rounds_are_consistent_with_seed(self):
        """Same round + same seed should always return the same pair."""
        pair1 = get_pair_for_round(1, session_seed="consistency-test")
        pair2 = get_pair_for_round(1, session_seed="consistency-test")
        assert pair1["id"] == pair2["id"]

    def test_all_rounds_return_different_pairs(self):
        """Rounds 1-5 should each return a different pair."""
        pair_ids = []
        for r in range(1, 6):
            pair = get_pair_for_round(r, session_seed="unique-rounds-test")
            pair_ids.append(pair["id"])
        assert len(pair_ids) == len(set(pair_ids))


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

    def test_no_duplicate_tmdb_ids_across_pairs(self):
        """No TMDB ID should appear in multiple pairs."""
        ids: dict[int, str] = {}
        for pair in ALL_PAIRS:
            for side in ["movie_a", "movie_b"]:
                tid = pair[side]["tmdb_id"]
                assert tid not in ids, (
                    f"TMDB ID {tid} appears in both {ids[tid]} and {pair['id']} ({side})"
                )
                ids[tid] = f"{pair['id']} ({side})"

    def test_has_at_least_40_pairs(self):
        assert len(ALL_PAIRS) >= 40

    def test_sufficient_pairs_per_quadrant_axis(self):
        """Each quadrant axis should have enough pairs for variety."""
        from collections import Counter
        dim_counts = Counter(p["dimension"] for p in ALL_PAIRS)
        for axis in REQUIRED_AXES:
            assert dim_counts[axis] >= 5, (
                f"Axis {axis} only has {dim_counts[axis]} pairs, need at least 5"
            )
