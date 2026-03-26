"""Tests for matcher query behavior."""

import uuid
from collections.abc import Iterator
from types import SimpleNamespace

import pytest

from app.services.matcher import (
    _compute_percentile_rank,
    _compute_quadrant_similarity,
    find_matches,
)


class _IterableResult:
    def __init__(self, rows: list[tuple]):
        self._rows = rows

    def __iter__(self) -> Iterator[tuple]:
        return iter(self._rows)


class _CandidatesResult:
    def all(self) -> list[tuple]:
        return []


class _RecordingSession:
    def __init__(self):
        self.statements = []
        self._call_count = 0

    async def execute(self, statement):
        self.statements.append(statement)
        self._call_count += 1
        if self._call_count in (1, 2):
            return _IterableResult([])
        return _CandidatesResult()

    async def commit(self):
        return None


class TestQuadrantSimilarity:
    """Test quadrant similarity calculation."""

    def test_identical_scores_return_one(self):
        scores = {"mainstream_independent": 3.0, "rational_emotional": 2.0, "light_dark": 4.0}
        assert _compute_quadrant_similarity(scores, scores) == 1.0

    def test_opposite_scores_return_low(self):
        scores_a = {"mainstream_independent": 1.0, "rational_emotional": 1.0, "light_dark": 1.0}
        scores_b = {"mainstream_independent": 5.0, "rational_emotional": 5.0, "light_dark": 5.0}
        result = _compute_quadrant_similarity(scores_a, scores_b)
        assert result < 0.05  # near 0

    def test_partial_difference(self):
        scores_a = {"mainstream_independent": 2.0, "rational_emotional": 3.0, "light_dark": 4.0}
        scores_b = {"mainstream_independent": 3.0, "rational_emotional": 3.0, "light_dark": 4.0}
        result = _compute_quadrant_similarity(scores_a, scores_b)
        assert 0.8 < result < 1.0  # mostly similar

    def test_none_scores_return_neutral(self):
        assert _compute_quadrant_similarity(None, {"mainstream_independent": 3.0}) == 0.5
        assert _compute_quadrant_similarity({"mainstream_independent": 3.0}, None) == 0.5

    def test_missing_axes_default_to_neutral(self):
        scores_a = {"mainstream_independent": 3.0}
        scores_b = {"mainstream_independent": 3.0}
        result = _compute_quadrant_similarity(scores_a, scores_b)
        # Missing axes default to 3.0, so distance should be 0
        assert result == 1.0


class TestPercentileRank:
    def test_percentile_rank_returns_expected_relative_position(self):
        scores = [0.95, 0.88, 0.8, 0.72, 0.61]
        assert _compute_percentile_rank(0.88, scores) == 80

    def test_percentile_rank_returns_none_for_empty_distribution(self):
        assert _compute_percentile_rank(0.88, []) is None


@pytest.mark.asyncio
async def test_find_matches_filters_to_active_profiles_only():
    db = _RecordingSession()
    user = SimpleNamespace(
        id=uuid.uuid4(),
        dna_profile=SimpleNamespace(tag_vector=[0.1, 0.2, 0.3]),
        pure_taste_match=True,
        match_gender_pref=None,
        match_age_min=None,
        match_age_max=None,
    )

    await find_matches(db, user)

    candidate_query = db.statements[2]
    compiled = str(candidate_query)
    assert "dna_profiles.is_active" in compiled
