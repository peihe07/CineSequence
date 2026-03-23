"""Unit tests for sequencing DNA enqueue fallback behavior."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.routers.sequencing import _enqueue_dna_build


@pytest.mark.asyncio
@patch("app.routers.sequencing.logger")
@patch("app.tasks.match_tasks.find_matches_task")
@patch("app.tasks.dna_tasks.build_dna_for_user", new_callable=AsyncMock)
@patch("app.tasks.dna_tasks.build_dna_task")
async def test_enqueue_dna_build_uses_celery_when_available(
    mock_build_dna_task,
    mock_build_dna_for_user,
    mock_find_matches_task,
    mock_logger,
):
    user_id = uuid.uuid4()

    await _enqueue_dna_build(user_id)

    mock_build_dna_task.delay.assert_called_once_with(str(user_id))
    mock_build_dna_for_user.assert_not_awaited()
    mock_find_matches_task.delay.assert_not_called()
    mock_logger.exception.assert_not_called()


@pytest.mark.asyncio
@patch("app.routers.sequencing.logger")
@patch("app.tasks.match_tasks.find_matches_task")
@patch("app.tasks.dna_tasks.build_dna_for_user", new_callable=AsyncMock)
@patch("app.tasks.dna_tasks.build_dna_task")
async def test_enqueue_dna_build_falls_back_to_inline_build_when_celery_fails(
    mock_build_dna_task,
    mock_build_dna_for_user,
    mock_find_matches_task,
    mock_logger,
):
    user_id = uuid.uuid4()
    mock_build_dna_task.delay.side_effect = RuntimeError("redis unavailable")

    await _enqueue_dna_build(user_id)

    mock_build_dna_task.delay.assert_called_once_with(str(user_id))
    mock_build_dna_for_user.assert_awaited_once_with(str(user_id))
    mock_find_matches_task.delay.assert_called_once_with(str(user_id))
    mock_logger.exception.assert_called_once()


@pytest.mark.asyncio
@patch("app.routers.sequencing.logger")
@patch("app.tasks.match_tasks.find_matches_task")
@patch("app.tasks.dna_tasks.build_dna_for_user", new_callable=AsyncMock)
@patch("app.tasks.dna_tasks.build_dna_task")
async def test_enqueue_dna_build_logs_when_inline_match_enqueue_fails(
    mock_build_dna_task,
    mock_build_dna_for_user,
    mock_find_matches_task,
    mock_logger,
):
    user_id = uuid.uuid4()
    mock_build_dna_task.delay.side_effect = RuntimeError("redis unavailable")
    mock_find_matches_task.delay.side_effect = RuntimeError("redis still unavailable")

    await _enqueue_dna_build(user_id)

    mock_build_dna_for_user.assert_awaited_once_with(str(user_id))
    mock_find_matches_task.delay.assert_called_once_with(str(user_id))
    assert mock_logger.exception.call_count == 2
