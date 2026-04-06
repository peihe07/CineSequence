"""Unit tests for match message rate limiting logic."""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.routers.match_messages import (
    RATE_LIMIT_DEFAULT,
    RATE_LIMIT_FIRST_24H,
    _check_rate_limit,
)


def _make_match(responded_hours_ago: float):
    """Create a mock match with responded_at set to N hours ago."""
    match = MagicMock()
    match.id = "match-1"
    match.responded_at = datetime.now(UTC) - timedelta(hours=responded_hours_ago)
    match.created_at = match.responded_at
    return match


def _mock_db_count(count: int):
    """Create a mock db session that returns a count."""
    db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar.return_value = count
    db.execute = AsyncMock(return_value=mock_result)
    return db


@pytest.mark.asyncio
async def test_rate_limit_first_24h_allows_under_limit():
    match = _make_match(responded_hours_ago=2)
    db = _mock_db_count(RATE_LIMIT_FIRST_24H - 1)
    # Should not raise
    await _check_rate_limit(db, match, "sender-1")


@pytest.mark.asyncio
async def test_rate_limit_first_24h_blocks_at_limit():
    match = _make_match(responded_hours_ago=2)
    db = _mock_db_count(RATE_LIMIT_FIRST_24H)

    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await _check_rate_limit(db, match, "sender-1")
    assert exc_info.value.status_code == 429


@pytest.mark.asyncio
async def test_rate_limit_after_24h_uses_lower_limit():
    match = _make_match(responded_hours_ago=48)
    db = _mock_db_count(RATE_LIMIT_DEFAULT)

    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await _check_rate_limit(db, match, "sender-1")
    assert exc_info.value.status_code == 429


@pytest.mark.asyncio
async def test_rate_limit_after_24h_allows_under_limit():
    match = _make_match(responded_hours_ago=48)
    db = _mock_db_count(RATE_LIMIT_DEFAULT - 1)
    # Should not raise
    await _check_rate_limit(db, match, "sender-1")


def test_rate_limit_constants():
    assert RATE_LIMIT_FIRST_24H == 60
    assert RATE_LIMIT_DEFAULT == 20
