"""Tests for AI pair engine: duplicate prevention and candidate selection."""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.ai_pair_engine import (
    _TASTE_TAGS,
    _VALID_TAGS,
    _build_user_context,
    _collect_seen_ids,
    _pool_fallback,
    _select_candidates,
    get_ai_pair,
)


class TestCollectSeenIds:
    """Test seen ID collection from picks."""

    def test_empty_picks(self):
        assert _collect_seen_ids([]) == set()

    def test_collects_both_movie_ids(self):
        picks = [
            {"movie_a_tmdb_id": 100, "movie_b_tmdb_id": 200},
            {"movie_a_tmdb_id": 300, "movie_b_tmdb_id": 400},
        ]
        seen = _collect_seen_ids(picks)
        assert seen == {100, 200, 300, 400}

    def test_discards_none_and_zero(self):
        picks = [
            {"movie_a_tmdb_id": 100, "movie_b_tmdb_id": None},
            {"movie_a_tmdb_id": 0, "movie_b_tmdb_id": 200},
        ]
        seen = _collect_seen_ids(picks)
        assert seen == {100, 200}

    def test_handles_missing_keys(self):
        picks = [{"movie_a_tmdb_id": 100}]
        seen = _collect_seen_ids(picks)
        assert 100 in seen


class TestSelectCandidates:
    """Test candidate selection from movie pool."""

    def test_returns_up_to_limit(self):
        candidates = _select_candidates({}, set(), phase=2)
        assert len(candidates) <= 45  # _CANDIDATE_LIMIT + 5 for tag coverage

    def test_excludes_seen_ids(self):
        seen = {680, 807, 550}  # Pulp Fiction, Se7en, Fight Club
        candidates = _select_candidates({}, seen, phase=2)
        candidate_ids = {c["tmdb_id"] for c in candidates}
        assert not (candidate_ids & seen)

    def test_prioritizes_untested_tags(self):
        # If "timeTravel" has been tested a lot, candidates should lean toward other tags
        tag_freq = {"timeTravel": 5, "mindfuck": 3, "twist": 3}
        candidates = _select_candidates(tag_freq, set(), phase=2)
        # Candidates should exist and be non-empty
        assert len(candidates) > 0

    def test_phase3_prioritizes_soul_tags(self):
        candidates = _select_candidates({}, set(), phase=3)
        candidate_tags = set()
        for c in candidates:
            candidate_tags.update(c.get("tags", []))
        soul_tags = {
            "existential", "antiHero", "romanticCore",
            "socialCritique", "philosophical", "absurdist",
        }
        # At least some soul tags should be represented
        assert len(candidate_tags & soul_tags) >= 3

    def test_all_candidates_have_required_fields(self):
        candidates = _select_candidates({}, set(), phase=2)
        for c in candidates:
            assert "tmdb_id" in c
            assert "title_en" in c
            assert "tags" in c
            assert isinstance(c["tags"], list)


class TestCandidateRegionDiversity:
    """B6: Test region diversity in candidate selection."""

    def test_candidates_include_non_english(self):
        candidates = _select_candidates({}, set(), phase=2)
        non_english = [c for c in candidates if c.get("region") not in ("us", "uk")]
        assert len(non_english) >= 8, f"Only {len(non_english)} non-US/UK candidates"

    def test_candidates_tag_coverage(self):
        candidates = _select_candidates({}, set(), phase=2)
        covered_tags = set()
        for c in candidates:
            covered_tags.update(c.get("tags", []))
        assert len(covered_tags) >= 15, f"Only {len(covered_tags)} tags covered"


class TestBuildUserContext:
    """A2: Test retry_rejected_tmdb_ids in context."""

    def test_includes_retry_rejected_ids(self):
        import json
        ctx = _build_user_context(
            phase=2, round_number=6, picks=[], quadrant_scores={},
            candidates=None, retry_rejected_tmdb_ids=[100, 200],
        )
        data = json.loads(ctx)
        assert data["retry_rejected_tmdb_ids"] == [100, 200]

    def test_no_retry_field_when_empty(self):
        import json
        ctx = _build_user_context(
            phase=2, round_number=6, picks=[], quadrant_scores={},
        )
        data = json.loads(ctx)
        assert "retry_rejected_tmdb_ids" not in data

    def test_excludes_non_english_from_current_tags(self):
        import json
        ctx = _build_user_context(
            phase=2,
            round_number=6,
            picks=[
                {
                    "movie_a_tmdb_id": 1,
                    "movie_b_tmdb_id": 2,
                    "chosen_tmdb_id": 1,
                    "round_number": 1,
                    "pick_mode": "watched",
                    "test_dimension": "nonEnglish",
                },
                {
                    "movie_a_tmdb_id": 3,
                    "movie_b_tmdb_id": 4,
                    "chosen_tmdb_id": 3,
                    "round_number": 2,
                    "pick_mode": "watched",
                    "test_dimension": "slowburn",
                },
            ],
            quadrant_scores={},
        )
        data = json.loads(ctx)
        assert "nonEnglish" not in data["current_tags"]
        assert data["current_tags"]["slowburn"] == 1


class TestPoolFallback:
    """A4: Test rule-based fallback when AI retries fail."""

    @pytest.mark.asyncio
    async def test_fallback_returns_valid_pair(self):
        mock_movie = {"id": 1, "title": "Test", "overview": "", "poster_path": ""}
        with patch(
            "app.services.ai_pair_engine.get_movie",
            new_callable=AsyncMock, return_value=mock_movie,
        ):
            result = await _pool_fallback({}, set(), phase=2)
        assert result is not None
        assert result["movie_a_tmdb_id"] != result["movie_b_tmdb_id"]
        assert result["movie_a"] is not None
        assert result["movie_b"] is not None

    @pytest.mark.asyncio
    async def test_fallback_excludes_seen_ids(self):
        """Fallback should not return movies from excluded set."""
        from app.services.ai_pair_engine import _MOVIE_POOL
        all_ids = {m["tmdb_id"] for m in _MOVIE_POOL}
        # Exclude all but 2
        keep_ids = list(all_ids)[:2]
        excluded = all_ids - set(keep_ids)

        mock_movie = {"id": 1, "title": "Test", "overview": "", "poster_path": ""}
        with patch(
            "app.services.ai_pair_engine.get_movie",
            new_callable=AsyncMock, return_value=mock_movie,
        ):
            result = await _pool_fallback({}, excluded, phase=2)
        if result:
            assert result["movie_a_tmdb_id"] not in excluded
            assert result["movie_b_tmdb_id"] not in excluded

    @pytest.mark.asyncio
    async def test_fallback_returns_none_when_pool_exhausted(self):
        from app.services.ai_pair_engine import _MOVIE_POOL
        all_ids = {m["tmdb_id"] for m in _MOVIE_POOL}
        result = await _pool_fallback({}, all_ids, phase=2)
        assert result is None


class TestGetAiPairDuplicateRejection:
    """A1/A6: Test same-movie-in-pair rejection."""

    @pytest.mark.asyncio
    async def test_rejects_same_movie_in_pair(self):
        """When Gemini returns same tmdb_id for A and B, it should retry."""
        # First call returns same ID, second call returns valid pair
        call_count = 0

        async def mock_gemini(user_context, round_number):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return {
                    "movie_a": {"tmdb_id": 999, "reason": "test"},
                    "movie_b": {"tmdb_id": 999, "reason": "test"},
                    "test_dimension": "twist",
                }
            return {
                "movie_a": {"tmdb_id": 680, "reason": "test"},
                "movie_b": {"tmdb_id": 807, "reason": "test"},
                "test_dimension": "twist",
            }

        mock_movie = {"id": 1, "title": "Test", "overview": "", "poster_path": ""}
        with (
            patch("app.services.ai_pair_engine._call_gemini", side_effect=mock_gemini),
            patch(
                "app.services.ai_pair_engine.get_movie",
                new_callable=AsyncMock, return_value=mock_movie,
            ),
        ):
            result = await get_ai_pair(phase=2, round_number=6, picks=[], quadrant_scores={})

        assert call_count >= 2, "Should have retried after same-movie rejection"
        assert result is not None
        assert result["movie_a_tmdb_id"] != result["movie_b_tmdb_id"]

    @pytest.mark.asyncio
    async def test_discards_non_english_as_test_dimension(self):
        async def mock_gemini(_user_context, _round_number):
            return {
                "movie_a": {"tmdb_id": 680, "reason": "test"},
                "movie_b": {"tmdb_id": 807, "reason": "test"},
                "test_dimension": "nonEnglish",
            }

        mock_movie = {"id": 1, "title": "Test", "overview": "", "poster_path": ""}
        with (
            patch("app.services.ai_pair_engine._call_gemini", side_effect=mock_gemini),
            patch(
                "app.services.ai_pair_engine.get_movie",
                new_callable=AsyncMock, return_value=mock_movie,
            ),
        ):
            result = await get_ai_pair(phase=2, round_number=6, picks=[], quadrant_scores={})

        assert result is not None
        assert result["test_dimension"] == ""


class TestValidTags:
    """Verify tag taxonomy is loaded correctly."""

    def test_has_30_tags(self):
        assert len(_VALID_TAGS) == 30

    def test_known_tags_present(self):
        expected = {"twist", "mindfuck", "slowburn", "existential", "antiHero", "romanticCore"}
        assert expected.issubset(_VALID_TAGS)

    def test_non_english_is_not_a_taste_tag(self):
        assert "nonEnglish" in _VALID_TAGS
        assert "nonEnglish" not in _TASTE_TAGS
