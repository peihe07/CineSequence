import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.services.ai_personality import (
    _build_context,
    _clear_personality_cache,
    generate_personality,
)


@pytest.fixture(autouse=True)
def clear_personality_cache():
    _clear_personality_cache()
    yield
    _clear_personality_cache()


def test_build_context_strips_movie_titles_and_keeps_abstract_signals():
    picks = [
        {
            "round_number": 1,
            "phase": 1,
            "chosen_tmdb_id": 10,
            "pick_mode": "watched",
            "test_dimension": "mindfuck",
            "chosen_title": "Inception",
            "movie_a_tmdb_id": 10,
            "movie_a_title": "Inception",
            "movie_b_tmdb_id": 20,
            "movie_b_title": "La La Land",
        },
        {
            "round_number": 2,
            "phase": 2,
            "chosen_tmdb_id": None,
            "pick_mode": None,
            "test_dimension": "slowburn",
            "movie_a_tmdb_id": 30,
            "movie_a_title": "The Matrix",
            "movie_b_tmdb_id": 40,
            "movie_b_title": "Spirited Away",
        },
    ]

    context = _build_context(
        picks=picks,
        tag_labels={"mindfuck": 1.0},
        excluded_tags=["tearjerker"],
        genre_vector={"Science Fiction": 1.0},
        quadrant_scores={"light_dark": 4.0},
        archetype_id="dark_poet",
    )

    payload = json.loads(context)

    assert payload["picks"] == [
        {
            "round": 1,
            "phase": 1,
            "pick_mode": "watched",
            "test_dimension": "mindfuck",
        }
    ]
    assert payload["skips"] == [
        {
            "round": 2,
            "phase": 2,
            "pick_mode": None,
            "test_dimension": "slowburn",
        }
    ]
    assert "title" not in context
    assert "chosen_title" not in context
    assert "movie_a_title" not in context
    assert "movie_b_title" not in context


@pytest.mark.asyncio
async def test_generate_personality_reuses_cached_result_for_identical_context():
    response = SimpleNamespace(
        text=json.dumps({
            "personality_reading": "cached reading",
            "hidden_traits": ["curious"],
            "conversation_style": "warm",
            "ideal_movie_date": "cinema",
        }),
        usage_metadata=None,
    )
    generate_content = AsyncMock(return_value=response)
    client = SimpleNamespace(
        aio=SimpleNamespace(models=SimpleNamespace(generate_content=generate_content))
    )

    with (
        patch("app.services.ai_personality.genai.Client", return_value=client),
        patch("app.services.ai_personality.log_token_usage", new_callable=AsyncMock),
    ):
        kwargs = {
            "picks": [],
            "tag_labels": {"mindfuck": 1.0},
            "excluded_tags": ["tearjerker"],
            "genre_vector": {"Science Fiction": 1.0},
            "quadrant_scores": {"light_dark": 4.0},
            "archetype_id": "dark_poet",
        }
        first = await generate_personality(**kwargs)
        second = await generate_personality(**kwargs)

    assert generate_content.await_count == 1
    assert first == second
