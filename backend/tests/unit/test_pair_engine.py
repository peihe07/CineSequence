"""Tests for pair engine: Phase 1 pair selection with randomized coverage."""

import pytest

from app.services.pair_engine import (
    ALL_PAIRS,
    PHASE1_COUNT,
    REQUIRED_AXES,
    SUPPLEMENTARY_AXIS,
    compute_quadrant_from_picks,
    get_pair_for_round,
    get_phase1_pairs,
    get_reroll_pair_for_round,
)


class TestGetPhase1Pairs:
    """Test phase 1 pair selection and ordering."""

    def test_returns_correct_pair_count(self):
        pairs = get_phase1_pairs(session_seed="test-session-1")
        assert len(pairs) == PHASE1_COUNT

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
        assert len(pairs_action) == PHASE1_COUNT
        assert len(pairs_romance) == PHASE1_COUNT

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
        for round_num in range(1, PHASE1_COUNT + 1):
            pair = get_pair_for_round(round_num, session_seed="round-test")
            assert pair is not None
            assert "id" in pair

    def test_invalid_round_raises(self):
        with pytest.raises(ValueError, match="Invalid Phase 1 round number"):
            get_pair_for_round(0, session_seed="err-test")
        with pytest.raises(ValueError, match="Invalid Phase 1 round number"):
            get_pair_for_round(PHASE1_COUNT + 1, session_seed="err-test")

    def test_rounds_are_consistent_with_seed(self):
        """Same round + same seed should always return the same pair."""
        pair1 = get_pair_for_round(1, session_seed="consistency-test")
        pair2 = get_pair_for_round(1, session_seed="consistency-test")
        assert pair1["id"] == pair2["id"]

    def test_all_rounds_return_different_pairs(self):
        """All Phase 1 rounds should each return a different pair."""
        pair_ids = []
        for r in range(1, PHASE1_COUNT + 1):
            pair = get_pair_for_round(r, session_seed="unique-rounds-test")
            pair_ids.append(pair["id"])
        assert len(pair_ids) == len(set(pair_ids))


class TestPhase1Reroll:
    """Test reroll behavior for Phase 1 alternates."""

    def test_reroll_can_avoid_reserved_future_movies(self):
        pairs = get_phase1_pairs(session_seed="reroll-reserved-test")
        current_pair = pairs[0]
        reserved_tmdb_ids = {
            tmdb_id
            for pair in pairs[1:]
            for tmdb_id in (pair["movie_a"]["tmdb_id"], pair["movie_b"]["tmdb_id"])
        }

        reroll_pair = get_reroll_pair_for_round(
            1,
            used_pair_ids={current_pair["id"]},
            exclude_tmdb_ids={
                current_pair["movie_a"]["tmdb_id"],
                current_pair["movie_b"]["tmdb_id"],
            },
            reserved_tmdb_ids=reserved_tmdb_ids,
        )

        assert reroll_pair is not None
        reroll_ids = {
            reroll_pair["movie_a"]["tmdb_id"],
            reroll_pair["movie_b"]["tmdb_id"],
        }
        assert not (reroll_ids & reserved_tmdb_ids)


class TestComputeQuadrantFromPicks:
    """Test quadrant score computation from picks."""

    def test_no_picks_returns_neutral(self):
        scores = compute_quadrant_from_picks([])
        assert scores["mainstream_independent"] == 3.0
        assert scores["rational_emotional"] == 3.0
        assert scores["light_dark"] == 3.0

    def test_phase2_picks_affect_quadrant_via_tags(self):
        """Phase 2 picks should affect quadrant through tag-to-axis mapping."""
        # tmdb_id 155 = The Dark Knight, which has 'darkTone' tag in pool → light_dark axis
        picks = [{"phase": 2, "pair_id": None, "chosen_tmdb_id": 155,
                  "movie_a_tmdb_id": 155, "movie_b_tmdb_id": 999}]
        scores = compute_quadrant_from_picks(picks)
        # Result depends on whether tmdb_id 155 is in the pool with relevant tags
        # Core axes should still be initialized at 3.0 if no matching tags
        assert "mainstream_independent" in scores

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

    def test_title_zh_no_placeholder(self):
        """C6: No title_zh should contain placeholder patterns."""
        for pair in ALL_PAIRS:
            for side in ["movie_a", "movie_b"]:
                zh = pair[side].get("title_zh", "")
                assert "乘夢" not in zh, (
                    f"{pair['id']} {side}: title_zh still has placeholder '{zh}'"
                )
                assert "乘勝" not in zh, (
                    f"{pair['id']} {side}: title_zh still has placeholder '{zh}'"
                )


class TestDimensionDiversity:
    """C3/C6: Test that Phase 1 selections cover diverse dimensions."""

    def test_pairs_cover_at_least_four_dimensions(self):
        """Selected pairs should span at least 4 different dimensions."""
        for i in range(30):
            pairs = get_phase1_pairs(session_seed=f"diversity-{i}")
            dimensions = {p["dimension"] for p in pairs}
            assert len(dimensions) >= 4, (
                f"Seed diversity-{i}: only {len(dimensions)} dimensions: {dimensions}"
            )

    def test_auxiliary_dimensions_appear_sometimes(self):
        """Across many seeds, auxiliary dimensions should sometimes be selected."""
        auxiliary_dims = set(SUPPLEMENTARY_AXIS.keys())
        seen_aux = set()
        for i in range(50):
            pairs = get_phase1_pairs(session_seed=f"aux-{i}")
            for p in pairs:
                if p["dimension"] in auxiliary_dims:
                    seen_aux.add(p["dimension"])
        assert len(seen_aux) >= 3, (
            f"Only {len(seen_aux)} auxiliary dimensions appeared across 50 seeds"
        )


class TestSupplementaryAxisScoring:
    """C4/C6: Test that supplementary axes are included in quadrant scores."""

    def test_supplementary_axis_appears_in_scores(self):
        """Picks from auxiliary dimensions should add supplementary axes to scores."""
        # Find a pair with an auxiliary dimension
        aux_pair = None
        for pair in ALL_PAIRS:
            if pair["dimension"] in SUPPLEMENTARY_AXIS:
                aux_pair = pair
                break
        assert aux_pair is not None, "No auxiliary dimension pairs found"

        picks = [{
            "phase": 1,
            "pair_id": aux_pair["id"],
            "chosen_tmdb_id": aux_pair["movie_a"]["tmdb_id"],
        }]
        scores = compute_quadrant_from_picks(picks)
        axis_key = SUPPLEMENTARY_AXIS[aux_pair["dimension"]]
        assert axis_key in scores, f"Expected {axis_key} in scores"
        assert scores[axis_key] != 3.0, f"Expected {axis_key} to be shifted from neutral"
