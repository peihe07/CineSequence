import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.services.ai_personality import (
    _build_context,
    _clear_personality_cache,
    _normalize_personality_result,
    generate_personality,
)


@pytest.fixture(autouse=True)
def clear_personality_cache():
    _clear_personality_cache()
    yield
    _clear_personality_cache()


def test_build_context_keeps_movie_titles_signal_details_and_comparisons():
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
        top_tags=["mindfuck", "darkTone", "dialogue"],
        excluded_tags=["tearjerker"],
        tag_confidence={"mindfuck": 1.0, "darkTone": 0.67, "dialogue": 0.67, "slowburn": 1.0},
        tag_consistency={"mindfuck": 1.0, "darkTone": 0.75, "dialogue": 0.67, "slowburn": 0.0},
        genre_vector={"Science Fiction": 1.0},
        quadrant_scores={"light_dark": 4.0},
        archetype_id="dark_poet",
        comparison_evidence=[
            {
                "round": 1,
                "chosen_title": "Inception",
                "rejected_title": "La La Land",
                "dimension": "mindfuck",
                "focus_tags": ["mindfuck"],
                "chosen_tags": ["mindfuck", "visualFeast"],
                "rejected_tags": ["romanticCore"],
            }
        ],
    )

    payload = json.loads(context)

    assert payload["picks"] == [
        {
            "round": 1,
            "phase": 1,
            "pick_mode": "watched",
            "test_dimension": "mindfuck",
            "chosen_title": "Inception",
            "rejected_title": "La La Land",
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
    assert payload["top_tags"] == ["mindfuck", "darkTone", "dialogue"]
    assert payload["top_tag_details"][0] == {
        "tag": "mindfuck",
        "score": 1.0,
        "confidence": 1.0,
        "consistency": 1.0,
    }
    assert payload["low_affinity_tags"] == [
        {
            "tag": "slowburn",
            "confidence": 1.0,
            "consistency": 0.0,
        }
    ]
    assert payload["comparison_evidence"] == [
        {
            "round": 1,
            "chosen_title": "Inception",
            "rejected_title": "La La Land",
            "dimension": "mindfuck",
            "focus_tags": ["mindfuck"],
            "chosen_tags": ["mindfuck", "visualFeast"],
            "rejected_tags": ["romanticCore"],
        }
    ]
    assert "chosen_title" in context
    assert "rejected_title" in context


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
            "top_tags": ["mindfuck", "darkTone", "dialogue"],
            "excluded_tags": ["tearjerker"],
            "tag_confidence": {"mindfuck": 1.0},
            "tag_consistency": {"mindfuck": 1.0},
            "genre_vector": {"Science Fiction": 1.0},
            "quadrant_scores": {"light_dark": 4.0},
            "archetype_id": "dark_poet",
            "comparison_evidence": [],
        }
        first = await generate_personality(**kwargs)
        second = await generate_personality(**kwargs)

    assert generate_content.await_count == 1
    assert first == second


def test_normalize_personality_result_trims_and_limits_fields():
    result = _normalize_personality_result({
        "personality_reading": "  這是一段很長的文字 " * 60,
        "hidden_traits": ["敏銳觀察者", "敏銳觀察者", "冷面幽默派", "節奏潔癖型"],
        "conversation_style": "  先冷靜觀察，再精準補一句有意思的話。這句之後不該留下。  ",
        "ideal_movie_date": (
            "  《午餐盒》《愛在黎明破曉時》《花束般的戀愛》適合你們，"
            "因為都能自然打開對話，後面這段也應該被裁掉。  "
        ),
    })

    assert len(result["personality_reading"]) <= 421
    assert len(result["personality_reading"]) > 220
    assert result["hidden_traits"] == ["敏銳觀察者", "冷面幽默派", "節奏潔癖型"]
    assert len(result["conversation_style"]) <= 31
    assert len(result["ideal_movie_date"]) <= 71
