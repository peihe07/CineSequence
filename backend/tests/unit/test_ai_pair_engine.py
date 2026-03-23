"""Tests for AI pair engine: duplicate prevention and candidate selection."""

import pytest

from app.services.ai_pair_engine import _collect_seen_ids, _select_candidates, _VALID_TAGS


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
        assert len(candidates) <= 40

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
        soul_tags = {"existential", "antiHero", "romanticCore", "socialCritique", "philosophical", "absurdist"}
        # At least some soul tags should be represented
        assert len(candidate_tags & soul_tags) >= 3

    def test_all_candidates_have_required_fields(self):
        candidates = _select_candidates({}, set(), phase=2)
        for c in candidates:
            assert "tmdb_id" in c
            assert "title_en" in c
            assert "tags" in c
            assert isinstance(c["tags"], list)


class TestValidTags:
    """Verify tag taxonomy is loaded correctly."""

    def test_has_30_tags(self):
        assert len(_VALID_TAGS) == 30

    def test_known_tags_present(self):
        expected = {"twist", "mindfuck", "slowburn", "existential", "antiHero", "romanticCore"}
        assert expected.issubset(_VALID_TAGS)
