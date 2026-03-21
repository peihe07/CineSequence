"""Phase 2-3 AI pair engine: Claude API generates adaptive movie pairs."""

import json
import logging
from pathlib import Path

import anthropic

from app.config import settings
from app.services.tmdb_client import get_movie

logger = logging.getLogger(__name__)

PROMPT_FILE = Path(__file__).resolve().parent.parent / "data" / "prompts" / "pair_picker.txt"
SYSTEM_PROMPT = PROMPT_FILE.read_text(encoding="utf-8")

REDIS_PREFETCH_PREFIX = "prefetch:pair:"
PREFETCH_TTL = 600  # 10 minutes


def _build_user_context(
    phase: int,
    round_number: int,
    picks: list[dict],
    quadrant_scores: dict,
) -> str:
    """Build the context string for Claude from user's pick history."""
    chosen_movies = []
    skipped_movies = []
    tag_freq: dict[str, int] = {}

    for pick in picks:
        movie_info = {
            "tmdb_id": pick.get("chosen_tmdb_id") or pick.get("movie_a_tmdb_id"),
            "round": pick.get("round_number"),
            "pick_mode": pick.get("pick_mode"),
        }
        if pick.get("chosen_tmdb_id"):
            chosen_movies.append(movie_info)
        else:
            skipped_movies.append(movie_info)

        # Accumulate tags from test dimensions
        dim = pick.get("test_dimension")
        if dim:
            tag_freq[dim] = tag_freq.get(dim, 0) + 1

    # Build all seen tmdb_ids to avoid repeats
    seen_ids = set()
    for pick in picks:
        seen_ids.add(pick.get("movie_a_tmdb_id"))
        seen_ids.add(pick.get("movie_b_tmdb_id"))
    seen_ids.discard(None)

    context = {
        "phase": phase,
        "round": round_number,
        "picks": chosen_movies[-10:],
        "skips": skipped_movies[-5:],
        "current_tags": tag_freq,
        "quadrant_vector": quadrant_scores,
        "already_seen_tmdb_ids": list(seen_ids),
    }

    return json.dumps(context, ensure_ascii=False)


async def get_ai_pair(
    phase: int,
    round_number: int,
    picks: list[dict],
    quadrant_scores: dict,
) -> dict | None:
    """Call Claude API to generate the next movie pair for Phase 2 or 3."""
    user_context = _build_user_context(phase, round_number, picks, quadrant_scores)

    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        message = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_context}],
        )
    except anthropic.APIError:
        logger.exception("Claude API error for round %s", round_number)
        return None

    # Parse the JSON response
    response_text = message.content[0].text.strip()

    # Extract JSON from potential markdown code block
    if "```" in response_text:
        start = response_text.find("{")
        end = response_text.rfind("}") + 1
        response_text = response_text[start:end]

    try:
        result = json.loads(response_text)
    except json.JSONDecodeError:
        logger.error("Failed to parse Claude response: %s", response_text[:200])
        return None

    # Validate tmdb_ids exist
    movie_a_id = result.get("movie_a", {}).get("tmdb_id")
    movie_b_id = result.get("movie_b", {}).get("tmdb_id")

    if not movie_a_id or not movie_b_id:
        logger.error("Claude returned missing tmdb_ids: %s", result)
        return None

    movie_a = await get_movie(movie_a_id)
    movie_b = await get_movie(movie_b_id)

    if not movie_a or not movie_b:
        logger.warning("TMDB validation failed for pair (%s, %s), retrying", movie_a_id, movie_b_id)
        return None

    return {
        "movie_a_tmdb_id": movie_a_id,
        "movie_b_tmdb_id": movie_b_id,
        "movie_a": movie_a,
        "movie_b": movie_b,
        "test_dimension": result.get("test_dimension", ""),
    }
