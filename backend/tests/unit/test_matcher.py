"""Tests for matcher query behavior."""

import uuid
from collections.abc import Iterator
from types import SimpleNamespace

import pytest

from app.services.matcher import find_matches


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

