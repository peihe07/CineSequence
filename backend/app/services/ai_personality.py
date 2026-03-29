"""AI personality service: Gemini API generates personality reading from DNA data."""

import json
import logging
import re
import time
from copy import deepcopy
from hashlib import sha256
from pathlib import Path

from google import genai

from app.config import settings
from app.services.ai_token_tracker import log_token_usage

logger = logging.getLogger(__name__)

PROMPT_FILE = Path(__file__).resolve().parent.parent / "data" / "prompts" / "personality.txt"
SYSTEM_PROMPT = PROMPT_FILE.read_text(encoding="utf-8")
_PERSONALITY_CACHE_TTL_SECONDS = 3600
_PERSONALITY_CACHE: dict[str, tuple[float, dict]] = {}


def _clean_text(value: str | None, *, max_len: int, fallback: str = "") -> str:
    if not value:
        return fallback
    cleaned = re.sub(r"\s+", " ", value).strip()
    if len(cleaned) <= max_len:
        return cleaned

    truncated = cleaned[:max_len].rstrip("，、；：,.!！？ ")
    return f"{truncated}。"


def _clean_traits(value: list | None) -> list[str]:
    if not isinstance(value, list):
        return []

    traits: list[str] = []
    for item in value:
        cleaned = _clean_text(str(item), max_len=6)
        if not cleaned or cleaned in traits:
            continue
        traits.append(cleaned)
        if len(traits) == 3:
            break
    return traits


def _normalize_personality_result(result: dict) -> dict:
    return {
        "personality_reading": _clean_text(
            result.get("personality_reading"),
            max_len=220,
        ),
        "hidden_traits": _clean_traits(result.get("hidden_traits")),
        "conversation_style": _clean_text(
            result.get("conversation_style"),
            max_len=30,
        ),
        "ideal_movie_date": _clean_text(
            result.get("ideal_movie_date"),
            max_len=70,
        ),
    }


def _build_tag_details(
    top_tags: list[str],
    tag_labels: dict[str, float],
    tag_confidence: dict[str, float],
    tag_consistency: dict[str, float],
) -> list[dict[str, float | str]]:
    details: list[dict[str, float | str]] = []
    for tag in top_tags[:3]:
        details.append({
            "tag": tag,
            "score": round(float(tag_labels.get(tag, 0.0)), 3),
            "confidence": round(float(tag_confidence.get(tag, 0.0)), 3),
            "consistency": round(float(tag_consistency.get(tag, 0.5)), 3),
        })
    return details


def _build_low_affinity_tags(
    excluded_tags: list[str],
    tag_confidence: dict[str, float],
    tag_consistency: dict[str, float],
) -> list[dict[str, float | str]]:
    low_affinity = [
        {
            "tag": tag,
            "confidence": round(float(tag_confidence.get(tag, 0.0)), 3),
            "consistency": round(float(ratio), 3),
        }
        for tag, ratio in tag_consistency.items()
        if ratio <= 0.34
    ]
    low_affinity.sort(key=lambda item: (item["confidence"], 1 - item["consistency"]), reverse=True)
    if low_affinity:
        return low_affinity[:3]

    return [
        {"tag": tag, "confidence": 0.0, "consistency": 0.0}
        for tag in excluded_tags[:3]
    ]


def _build_contradiction_tags(
    tag_confidence: dict[str, float],
    tag_consistency: dict[str, float],
) -> list[dict[str, float | str]]:
    contradictions = [
        {
            "tag": tag,
            "confidence": round(float(tag_confidence.get(tag, 0.0)), 3),
            "consistency": round(float(ratio), 3),
        }
        for tag, ratio in tag_consistency.items()
        if 0.35 <= ratio <= 0.65 and tag_confidence.get(tag, 0.0) >= 0.67
    ]
    contradictions.sort(key=lambda item: item["confidence"], reverse=True)
    return contradictions[:3]


def _build_context(
    picks: list[dict],
    tag_labels: dict[str, float],
    top_tags: list[str],
    excluded_tags: list[str],
    tag_confidence: dict[str, float],
    tag_consistency: dict[str, float],
    genre_vector: dict[str, float],
    quadrant_scores: dict,
    archetype_id: str,
    comparison_evidence: list[dict] | None = None,
) -> str:
    """Build user context for the personality prompt."""
    chosen = []
    skipped = []

    for pick in picks:
        entry = {
            "round": pick.get("round_number"),
            "phase": pick.get("phase"),
            "pick_mode": pick.get("pick_mode"),
            "test_dimension": pick.get("test_dimension"),
        }
        if pick.get("chosen_tmdb_id"):
            entry["chosen_title"] = pick.get("chosen_title")
            entry["rejected_title"] = (
                pick.get("movie_b_title")
                if pick.get("chosen_tmdb_id") == pick.get("movie_a_tmdb_id")
                else pick.get("movie_a_title")
            )
            chosen.append(entry)
        else:
            skipped.append(entry)

    return json.dumps({
        "picks": chosen,
        "skips": skipped,
        "tag_vector": tag_labels,
        "top_tags": top_tags[:3],
        "top_tag_details": _build_tag_details(top_tags, tag_labels, tag_confidence, tag_consistency),
        "low_affinity_tags": _build_low_affinity_tags(excluded_tags, tag_confidence, tag_consistency),
        "contradiction_tags": _build_contradiction_tags(tag_confidence, tag_consistency),
        "excluded_tags": excluded_tags[:10],
        "genre_vector": genre_vector,
        "quadrant_vector": quadrant_scores,
        "archetype_id": archetype_id,
        "comparison_evidence": comparison_evidence or [],
    }, ensure_ascii=False)


def _make_personality_cache_key(context: str) -> str:
    return sha256(context.encode("utf-8")).hexdigest()


def _get_cached_personality(cache_key: str) -> dict | None:
    cached = _PERSONALITY_CACHE.get(cache_key)
    if cached is None:
        return None

    expires_at, result = cached
    if expires_at <= time.monotonic():
        _PERSONALITY_CACHE.pop(cache_key, None)
        return None

    return deepcopy(result)


def _store_cached_personality(cache_key: str, result: dict) -> None:
    _PERSONALITY_CACHE[cache_key] = (
        time.monotonic() + _PERSONALITY_CACHE_TTL_SECONDS,
        deepcopy(result),
    )


def _clear_personality_cache() -> None:
    _PERSONALITY_CACHE.clear()


async def generate_personality(
    picks: list[dict],
    tag_labels: dict[str, float],
    top_tags: list[str],
    excluded_tags: list[str],
    tag_confidence: dict[str, float],
    tag_consistency: dict[str, float],
    genre_vector: dict[str, float],
    quadrant_scores: dict,
    archetype_id: str,
    comparison_evidence: list[dict] | None = None,
) -> dict | None:
    """Call Gemini API to generate personality reading.

    Returns dict with: personality_reading, hidden_traits,
    conversation_style, ideal_movie_date.
    """
    context = _build_context(
        picks, tag_labels, top_tags, excluded_tags,
        tag_confidence, tag_consistency,
        genre_vector, quadrant_scores, archetype_id, comparison_evidence,
    )
    cache_key = _make_personality_cache_key(context)
    cached = _get_cached_personality(cache_key)
    if cached is not None:
        logger.info("Using cached Gemini personality result")
        return cached

    max_retries = 2
    client = genai.Client(api_key=settings.gemini_api_key)
    model_candidates = settings.gemini_model_candidates

    for attempt in range(1, max_retries + 1):
        response = None
        model_used = ""
        for model_name in model_candidates:
            try:
                response = await client.aio.models.generate_content(
                    model=model_name,
                    contents=f"{SYSTEM_PROMPT}\n\n---\n\n{context}",
                    config={
                        "response_mime_type": "application/json",
                        "temperature": 0.9,
                        "max_output_tokens": 4096,
                        "thinking_config": {"thinking_budget": 0},
                    },
                )
                model_used = model_name
                break
            except Exception:
                logger.exception(
                    "Gemini API error for personality generation "
                    "(attempt %d, model %s)",
                    attempt,
                    model_name,
                )

        if response is None:
            if attempt == max_retries:
                return None
            continue

        await log_token_usage(response, call_type="personality", model=model_used)

        response_text = response.text.strip()

        # Extract JSON from potential markdown code block
        if "```" in response_text:
            start = response_text.find("{")
            end = response_text.rfind("}") + 1
            response_text = response_text[start:end]

        try:
            result = json.loads(response_text)
        except json.JSONDecodeError:
            logger.warning(
                "Failed to parse personality response (attempt %d): %s",
                attempt, response_text[:200],
            )
            if attempt == max_retries:
                return None
            continue

        final_result = _normalize_personality_result(result)
        _store_cached_personality(cache_key, final_result)
        return final_result

    return None
