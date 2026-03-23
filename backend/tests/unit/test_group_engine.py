"""Tests for group engine: affinity computation and auto-assign logic."""

from app.services.group_engine import (
    AUTO_ASSIGN_THRESHOLD,
    TAG_INDEX,
    TAG_KEYS,
    build_shared_watchlist,
    compute_group_affinity,
    get_shared_tags,
    recommend_movies_for_group,
    should_activate_group,
)


class TestComputeGroupAffinity:
    """Test group affinity score computation."""

    def test_empty_tags(self):
        vector = [0.0] * len(TAG_KEYS)
        assert compute_group_affinity(vector, []) == 0.0

    def test_empty_vector(self):
        assert compute_group_affinity([], ["mindfuck"]) == 0.0

    def test_single_tag_match(self):
        vector = [0.0] * len(TAG_KEYS)
        vector[TAG_INDEX["mindfuck"]] = 0.8
        score = compute_group_affinity(vector, ["mindfuck"])
        assert score == 0.8

    def test_multiple_tags_average(self):
        vector = [0.0] * len(TAG_KEYS)
        vector[TAG_INDEX["mindfuck"]] = 0.6
        vector[TAG_INDEX["twist"]] = 0.4
        score = compute_group_affinity(vector, ["mindfuck", "twist"])
        assert score == 0.5

    def test_partial_tag_match(self):
        """Only matching tags in the vector contribute."""
        vector = [0.0] * len(TAG_KEYS)
        vector[TAG_INDEX["existential"]] = 0.9
        # "existential" is in vector, "dialogue" is 0
        score = compute_group_affinity(vector, ["existential", "dialogue"])
        assert score == 0.45

    def test_all_zero_vector(self):
        vector = [0.0] * len(TAG_KEYS)
        score = compute_group_affinity(vector, ["mindfuck", "twist"])
        assert score == 0.0

    def test_invalid_tag_ignored(self):
        """Tags not in taxonomy are ignored (not counted in average)."""
        vector = [0.0] * len(TAG_KEYS)
        vector[TAG_INDEX["mindfuck"]] = 0.8
        score = compute_group_affinity(vector, ["mindfuck", "nonexistent_tag"])
        # Only "mindfuck" counts, "nonexistent_tag" ignored
        assert score == 0.8

    def test_high_affinity_for_mobius_loop_profile(self):
        """A profile strong in mindfuck/philosophical should match Mobius Loop."""
        vector = [0.0] * len(TAG_KEYS)
        vector[TAG_INDEX["mindfuck"]] = 0.7
        vector[TAG_INDEX["twist"]] = 0.5
        vector[TAG_INDEX["timeTravel"]] = 0.6
        vector[TAG_INDEX["philosophical"]] = 0.8
        mobius_tags = ["mindfuck", "twist", "timeTravel", "philosophical"]
        score = compute_group_affinity(vector, mobius_tags)
        assert round(score, 2) == 0.65
        assert score >= AUTO_ASSIGN_THRESHOLD

    def test_low_affinity_below_threshold(self):
        """A profile with weak signals should not exceed threshold."""
        vector = [0.0] * len(TAG_KEYS)
        vector[TAG_INDEX["mindfuck"]] = 0.1
        vector[TAG_INDEX["twist"]] = 0.05
        cafe_tags = ["dialogue", "slowburn", "satirical", "socialCritique", "existential"]
        score = compute_group_affinity(vector, cafe_tags)
        assert score < AUTO_ASSIGN_THRESHOLD

    def test_cafe_screening_match(self):
        """Profile with existential + dialogue should match Cafe Screening."""
        vector = [0.0] * len(TAG_KEYS)
        vector[TAG_INDEX["dialogue"]] = 0.5
        vector[TAG_INDEX["existential"]] = 0.9
        vector[TAG_INDEX["slowburn"]] = 0.3
        cafe_tags = ["dialogue", "slowburn", "satirical", "socialCritique", "existential"]
        score = compute_group_affinity(vector, cafe_tags)
        # (0.5 + 0.3 + 0 + 0 + 0.9) / 5 = 0.34
        assert round(score, 2) == 0.34
        assert score >= AUTO_ASSIGN_THRESHOLD


class TestThresholdBoundary:
    """Test threshold boundary conditions."""

    def test_exactly_at_threshold(self):
        vector = [0.0] * len(TAG_KEYS)
        vector[TAG_INDEX["mindfuck"]] = AUTO_ASSIGN_THRESHOLD
        score = compute_group_affinity(vector, ["mindfuck"])
        assert score == AUTO_ASSIGN_THRESHOLD
        assert score >= AUTO_ASSIGN_THRESHOLD

    def test_just_below_threshold(self):
        vector = [0.0] * len(TAG_KEYS)
        vector[TAG_INDEX["mindfuck"]] = AUTO_ASSIGN_THRESHOLD - 0.01
        score = compute_group_affinity(vector, ["mindfuck"])
        assert score < AUTO_ASSIGN_THRESHOLD


class TestSharedTagsAndRecommendations:
    def test_shared_tags_returns_strongest_overlap(self):
        vector = [0.0] * len(TAG_KEYS)
        vector[TAG_INDEX["mindfuck"]] = 0.9
        vector[TAG_INDEX["twist"]] = 0.6
        vector[TAG_INDEX["timeTravel"]] = 0.3

        shared = get_shared_tags(vector, ["twist", "mindfuck", "dialogue", "timeTravel"])
        assert shared == ["mindfuck", "twist", "timeTravel"]

    def test_recommend_movies_uses_group_tags(self):
        vector = [0.0] * len(TAG_KEYS)
        vector[TAG_INDEX["mindfuck"]] = 0.9
        vector[TAG_INDEX["twist"]] = 0.8

        movies = recommend_movies_for_group(["mindfuck", "twist"], vector, limit=3)
        assert len(movies) == 3
        assert all(movie["match_tags"] for movie in movies)
        assert any("mindfuck" in movie["match_tags"] or "twist" in movie["match_tags"] for movie in movies)

    def test_shared_watchlist_uses_member_overlap(self):
        member_a = [0.0] * len(TAG_KEYS)
        member_b = [0.0] * len(TAG_KEYS)
        member_a[TAG_INDEX["mindfuck"]] = 0.9
        member_a[TAG_INDEX["twist"]] = 0.8
        member_b[TAG_INDEX["mindfuck"]] = 0.7
        member_b[TAG_INDEX["twist"]] = 0.6

        watchlist = build_shared_watchlist(["mindfuck", "twist"], [member_a, member_b], limit=4)
        assert len(watchlist) == 4
        assert watchlist[0]["supporter_count"] >= 1
        assert any("mindfuck" in movie["match_tags"] or "twist" in movie["match_tags"] for movie in watchlist)


class TestShouldActivateGroup:
    def test_returns_true_at_threshold(self):
        assert should_activate_group(20, 20) is True

    def test_returns_false_below_threshold(self):
        assert should_activate_group(19, 20) is False
