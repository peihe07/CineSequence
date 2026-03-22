"""Phase 2-3 AI pair engine: Gemini API generates adaptive movie pairs."""

import json
import logging
from pathlib import Path

from google import genai

from app.config import settings
from app.services.tmdb_client import get_movie

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PROMPT_FILE = DATA_DIR / "prompts" / "pair_picker.txt"
SYSTEM_PROMPT = PROMPT_FILE.read_text(encoding="utf-8")

# Valid tag keys for test_dimension validation
with open(DATA_DIR / "tag_taxonomy.json") as _f:
    _VALID_TAGS = set(json.load(_f)["tags"].keys())


def _build_user_context(
    phase: int,
    round_number: int,
    picks: list[dict],
    quadrant_scores: dict,
) -> str:
    """Build the context string from user's pick history."""
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
    extra_excluded_tmdb_ids: list[int] | None = None,
) -> dict | None:
    """Call Gemini API to generate the next movie pair for Phase 2 or 3."""
    context_picks = list(picks)
    if extra_excluded_tmdb_ids:
        context_picks.extend(
            {
                "movie_a_tmdb_id": tmdb_id,
                "movie_b_tmdb_id": None,
                "chosen_tmdb_id": None,
                "round_number": round_number,
                "pick_mode": None,
                "test_dimension": None,
            }
            for tmdb_id in extra_excluded_tmdb_ids
        )

    user_context = _build_user_context(phase, round_number, context_picks, quadrant_scores)

    try:
        client = genai.Client(api_key=settings.gemini_api_key)
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"{SYSTEM_PROMPT}\n\n---\n\n{user_context}",
            config={
                "response_mime_type": "application/json",
                "temperature": 0.8,
                "max_output_tokens": 1024,
                "thinking_config": {"thinking_budget": 0},
            },
        )
    except Exception:
        logger.exception("Gemini API error for round %s", round_number)
        return None

    response_text = response.text.strip()

    # Extract JSON from potential markdown code block
    if "```" in response_text:
        start = response_text.find("{")
        end = response_text.rfind("}") + 1
        response_text = response_text[start:end]

    try:
        result = json.loads(response_text)
    except json.JSONDecodeError:
        logger.error("Failed to parse Gemini response: %s", response_text[:200])
        return None

    # Validate tmdb_ids exist
    movie_a_id = result.get("movie_a", {}).get("tmdb_id")
    movie_b_id = result.get("movie_b", {}).get("tmdb_id")

    if not movie_a_id or not movie_b_id:
        logger.error("Gemini returned missing tmdb_ids: %s", result)
        return None

    movie_a = await get_movie(movie_a_id)
    movie_b = await get_movie(movie_b_id)

    if not movie_a or not movie_b:
        logger.warning("TMDB validation failed for pair (%s, %s)", movie_a_id, movie_b_id)
        return None

    # Validate test_dimension is a known tag key
    test_dim = result.get("test_dimension", "")
    if test_dim not in _VALID_TAGS:
        logger.warning("Gemini returned invalid test_dimension '%s', discarding", test_dim)
        test_dim = ""

    return {
        "movie_a_tmdb_id": movie_a_id,
        "movie_b_tmdb_id": movie_b_id,
        "movie_a": movie_a,
        "movie_b": movie_b,
        "test_dimension": test_dim,
    }
